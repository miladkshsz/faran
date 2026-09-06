import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './styles.css';

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

const SERVICES = [
  'pm',
  'نصب اولیه',
  'بازدید فروش',
  'بازدید فنی',
  'اعلام خرابی رفاه',
  'اعلام خرابی مشتری'
];

const KEYWORDS = [
  'تاکسی',
  'ناهار',
  'صبحانه',
  'شام',
  'پذیرایی',
  'پارکینگ',
  'بنزین',
  'سوخت',
  'بلیط',
  'بلیت',
  'اقامت',
  'هتل',
  'مترو',
  'اتوبوس',
  'اسنپ',
  'تپسی'
];

const MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند'
];

const WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه'
];

const emptyRow = () => ({
  date: '',
  place: '',
  service: '',
  invoice: '',
  description: '',
  amount: ''
});

const toNum = value =>
  Number(
    String(value ?? '')
      .replace(/[,٬\s]/g, '')
      .replace(/[۰-۹]/g, d =>
        '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)
      )
  ) || 0;

const money = value => {
  const n = toNum(value);
  return n
    ? new Intl.NumberFormat('fa-IR').format(n)
    : '';
};

const hasKeyword = value =>
  KEYWORDS.some(k =>
    String(value || '').includes(k)
  );

const chunks = (arr, size) =>
  Array.from(
    {
      length: Math.ceil(arr.length / size)
    },
    (_, i) =>
      arr.slice(i * size, i * size + size)
  );


/* =========================================================
   تبدیل تاریخ شمسی / میلادی
   ========================================================= */

function jalaliToGregorian(jy, jm, jd) {
  let jy2 = jy + 1595;

  let days =
    -355668 +
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    jd +
    (jm < 7
      ? (jm - 1) * 31
      : (jm - 7) * 30 + 186);

  let gy = 400 * Math.floor(days / 146097);

  days %= 146097;

  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;

    if (days >= 365) {
      days++;
    }
  }

  gy += 4 * Math.floor(days / 1461);

  days %= 1461;

  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const gd = days + 1;

  const leap =
    gy % 4 === 0 &&
    (gy % 100 !== 0 || gy % 400 === 0);

  const md = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ];

  let gm = 1;
  let day = gd;

  while (
    day > md[gm - 1] &&
    gm <= 12
  ) {
    day -= md[gm - 1];
    gm++;
  }

  return {
    gy,
    gm,
    gd: day
  };
}

function gregorianToJalali(
  gy,
  gm,
  gd
) {
  const gdm = [
    0,
    31,
    59,
    90,
    120,
    151,
    181,
    212,
    243,
    273,
    304,
    334
  ];

  const gy2 =
    gm > 2 ? gy + 1 : gy;

  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    gdm[gm - 1];

  let jy =
    -1595 +
    33 * Math.floor(days / 12053);

  days %= 12053;

  jy +=
    4 * Math.floor(days / 1461);

  days %= 1461;

  if (days > 365) {
    jy +=
      Math.floor(
        (days - 1) / 365
      );

    days =
      (days - 1) % 365;
  }

  const jm =
    days < 186
      ? 1 +
        Math.floor(
          days / 31
        )
      : 7 +
        Math.floor(
          (days - 186) / 30
        );

  const jd =
    1 +
    (days < 186
      ? days % 31
      : (days - 186) % 30);

  return `${jy}/${String(
    jm
  ).padStart(2, '0')}/${String(
    jd
  ).padStart(2, '0')}`;
}

const parseJalali = value => {
  const m =
    String(value || '').match(
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
    );

  return m
    ? {
        y: Number(m[1]),
        m: Number(m[2]),
        d: Number(m[3])
      }
    : {
        y: 1404,
        m: 1,
        d: 1
      };
};

const monthLength = (
  y,
  m
) =>
  m <= 6
    ? 31
    : m <= 11
    ? 30
    : 29;

const pad = n =>
  String(n).padStart(2, '0');

const makeDate = (
  y,
  m,
  d
) =>
  `${y}/${pad(m)}/${pad(d)}`;


/* =========================================================
   تقویم شمسی
   ========================================================= */

function JalaliDate({
  value,
  onChange
}) {
  const [open, setOpen] =
    useState(false);

  const [view, setView] =
    useState(() => {
      const p =
        parseJalali(value);

      return {
        y: p.y,
        m: p.m
      };
    });

  const ref =
    useRef(null);

  useEffect(() => {
    const close = e => {
      if (
        ref.current &&
        !ref.current.contains(
          e.target
        )
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      close
    );

    return () =>
      document.removeEventListener(
        'mousedown',
        close
      );
  }, []);

  useEffect(() => {
    const p =
      parseJalali(value);

    setView({
      y: p.y,
      m: p.m
    });
  }, [value]);

  const selected =
    parseJalali(value);

  const first =
    jalaliToGregorian(
      view.y,
      view.m,
      1
    );

  const firstWeekday =
    new Date(
      first.gy,
      first.gm - 1,
      first.gd
    ).getDay();

  const saturdayIndex =
    (firstWeekday + 1) % 7;

  const days =
    monthLength(
      view.y,
      view.m
    );

  const cells = Array.from(
    {
      length:
        saturdayIndex + days
    },
    (_, i) =>
      i < saturdayIndex
        ? null
        : i -
          saturdayIndex +
          1
  );

  const selectDay = d => {
    onChange(
      makeDate(
        view.y,
        view.m,
        d
      )
    );

    setOpen(false);
  };

  const changeMonth =
    delta => {
      let m =
        view.m + delta;

      let y = view.y;

      if (m > 12) {
        m = 1;
        y++;
      }

      if (m < 1) {
        m = 12;
        y--;
      }

      setView({
        y,
        m
      });
    };

  return (
    <div
      className="jalali-date"
      ref={ref}
    >
      <button
        type="button"
        className="jalali-input"
        onClick={() =>
          setOpen(v => !v)
        }
      >
        <span
          className={
            value
              ? 'has-value'
              : ''
          }
        >
          {value ||
            'تاریخ شمسی'}
        </span>

        <span className="calendar-icon">
          📅
        </span>
      </button>

      {open && (
        <div
          className="jalali-calendar"
          dir="rtl"
        >
          <div className="jalali-calendar-head">
            <button
              type="button"
              onClick={() =>
                changeMonth(1)
              }
            >
              ‹
            </button>

            <strong>
              {
                MONTHS[
                  view.m - 1
                ]
              }{' '}
              {view.y}
            </strong>

            <button
              type="button"
              onClick={() =>
                changeMonth(-1)
              }
            >
              ›
            </button>
          </div>

          <div className="jalali-weekdays">
            {WEEKDAYS.map(
              day => (
                <span
                  key={day}
                >
                  {day}
                </span>
              )
            )}
          </div>

          <div className="jalali-days">
            {cells.map(
              (day, i) =>
                day ? (
                  <button
                    key={i}
                    type="button"
                    className={
                      selected.y ===
                        view.y &&
                      selected.m ===
                        view.m &&
                      selected.d ===
                        day
                        ? 'selected'
                        : ''
                    }
                    onClick={() =>
                      selectDay(
                        day
                      )
                    }
                  >
                    {day}
                  </button>
                ) : (
                  <span
                    key={i}
                  />
                )
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/* =========================================================
   صفحه امضا
   ========================================================= */

function SignaturePad({
  value,
  onChange,
  className = ''
}) {
  const canvasRef =
    useRef(null);

  const drawingRef =
    useRef(false);

  const lastPointRef =
    useRef(null);


  /*
   * Canvas کاملاً شفاف است.
   * اگر قبلاً امضایی ذخیره شده باشد،
   * همان امضا دوباره روی Canvas قرار می‌گیرد.
   */
  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext(
        '2d'
      );

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    /*
     * هیچ رنگ پس‌زمینه‌ای
     * اینجا قرار نمی‌دهیم.
     */
    ctx.globalCompositeOperation =
      'source-over';

    if (!value) return;

    const img =
      new Image();

    img.onload = () => {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.globalCompositeOperation =
        'source-over';

      ctx.drawImage(
        img,
        0,
        0,
        canvas.width,
        canvas.height
      );
    };

    img.src = value;
  }, [value]);


  const getPoint = e => {
    const canvas =
      canvasRef.current;

    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        (e.clientX -
          rect.left) *
        (canvas.width /
          rect.width),

      y:
        (e.clientY -
          rect.top) *
        (canvas.height /
          rect.height)
    };
  };


  const startDrawing =
    e => {
      e.preventDefault();

      const canvas =
        canvasRef.current;

      if (!canvas) return;

      try {
        canvas.setPointerCapture(
          e.pointerId
        );
      } catch {}

      drawingRef.current =
        true;

      lastPointRef.current =
        getPoint(e);
    };


  const draw = e => {
    if (
      !drawingRef.current
    )
      return;

    e.preventDefault();

    const canvas =
      canvasRef.current;

    const ctx =
      canvas.getContext(
        '2d'
      );

    const point =
      getPoint(e);

    const last =
      lastPointRef.current;

    if (!last) {
      lastPointRef.current =
        point;

      return;
    }

    ctx.beginPath();

    ctx.moveTo(
      last.x,
      last.y
    );

    ctx.lineTo(
      point.x,
      point.y
    );

    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';

    /*
     * فقط خود خط امضا
     * روی Canvas نوشته می‌شود.
     * هیچ Background وجود ندارد.
     */
    ctx.stroke();

    lastPointRef.current =
      point;
  };


  const stopDrawing =
    e => {
      if (
        !drawingRef.current
      )
        return;

      e.preventDefault();

      drawingRef.current =
        false;

      lastPointRef.current =
        null;

      const canvas =
        canvasRef.current;

      if (!canvas) return;

      /*
       * خروجی PNG دارای
       * پس‌زمینه شفاف است.
       */
      const signature =
        canvas.toDataURL(
          'image/png'
        );

      onChange(signature);
    };


  const clearSignature =
    e => {
      e.stopPropagation();

      const canvas =
        canvasRef.current;

      if (!canvas) return;

      const ctx =
        canvas.getContext(
          '2d'
        );

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      onChange('');
    };


  return (
    <div
      className={`signature-pad-wrap ${className}`}
    >
      <canvas
        ref={canvasRef}
        width={500}
        height={150}
        className="signature-pad"
        onPointerDown={
          startDrawing
        }
        onPointerMove={draw}
        onPointerUp={
          stopDrawing
        }
        onPointerCancel={
          stopDrawing
        }
      />

      <button
        type="button"
        className="signature-clear no-print"
        onClick={
          clearSignature
        }
      >
        پاک کردن امضا
      </button>
    </div>
  );
}


/* =========================================================
   برنامه اصلی
   ========================================================= */

function App() {
  const [header, setHeader] =
    useState({
      title:
        'فرم صورت ریز هزینه های تنخواه واحد خدمات',

      docCode:
        'FI-B-FO-112/00',

      serviceCode:
        'FI-B-RE-001/00',

      date:
        '1404/05/27',

      reviewDate: ''
    });


  const [rows, setRows] =
    useState(
      Array.from(
        { length: 8 },
        () => ({
          ...emptyRow(),
          date: '1404/05/27'
        })
      )
    );


  const [ni, setNi] =
    useState({
      formCode:
        'FI-B-FO-135/00',

      referenceCode:
        'FI-B-RE-001/00',

      date:
        '1404/05/27',

      requester: '',
      position: '',
      organization: '',
      reason: '',
      approverComment: '',
      notes: ''
    });


  /*
   * requester:
   * امضای تنظیم کننده
   *
   * confirmer:
   * نام/امضای تایید کننده
   *
   * issuer:
   * نام/امضای تصویب کننده
   */
  const [sig, setSig] =
    useState({
      requester: '',
      confirmer: '',
      issuer: ''
    });


  const [busy, setBusy] =
    useState(false);

  const [niBusy, setNiBusy] =
    useState(false);


  const total = useMemo(
    () =>
      rows.reduce(
        (sum, row) =>
          sum +
          toNum(row.amount),
        0
      ),
    [rows]
  );


  /*
   * انتقال خودکار هزینه‌های
   * بدون فاکتور
   */
  const niItems = useMemo(
    () =>
      rows
        .filter(
          row =>
            hasKeyword(
              row.description
            ) &&
            toNum(row.amount) >
              0
        )
        .map(row => ({
          product:
            String(
              row.description
            ).trim(),

          provider:
            row.place || '',

          qty: '1',

          unit:
            row.amount,

          total:
            row.amount,

          date:
            row.date ||
            header.date
        })),
    [rows, header.date]
  );


  const niPages =
    useMemo(
      () =>
        chunks(
          niItems,
          3
        ),
      [niItems]
    );


  const updateRow = (
    index,
    key,
    value
  ) => {
    setRows(prev =>
      prev.map(
        (row, i) =>
          i === index
            ? {
                ...row,
                [key]: value
              }
            : row
      )
    );
  };


  const updateMainDate =
    value => {
      setHeader(h => ({
        ...h,
        date: value
      }));

      setRows(prev =>
        prev.map(row => ({
          ...row,
          date: value
        }))
      );

      setNi(n => ({
        ...n,
        date: value
      }));
    };


  /* =========================================================
     ساخت PDF
     ========================================================= */

  const makePdf = async (
    node,
    filename,
    orientation = 'landscape'
  ) => {
    if (!node) return;

    const canvas =
      await html2canvas(
        node,
        {
          scale: 2.5,
          backgroundColor: '#fff',
          useCORS: true,
          allowTaint: false,
          logging: false
        }
      );

    const pdf =
      new jsPDF({
        orientation,
        unit: 'mm',
        format: 'a4',
        compress: true
      });

    const pageW =
      orientation ===
      'landscape'
        ? 297
        : 210;

    const pageH =
      orientation ===
      'landscape'
        ? 210
        : 297;

    const margin = 4;

    const ratio =
      Math.min(
        (pageW -
          margin * 2) /
          canvas.width,

        (pageH -
          margin * 2) /
          canvas.height
      );

    const w =
      canvas.width *
      ratio;

    const h =
      canvas.height *
      ratio;

    pdf.addImage(
      canvas.toDataURL(
        'image/jpeg',
        0.96
      ),
      'JPEG',
      (pageW - w) / 2,
      (pageH - h) / 2,
      w,
      h,
      undefined,
      'FAST'
    );

    pdf.save(filename);
  };


  const exportMain =
    async () => {
      setBusy(true);

      try {
        await makePdf(
          document.getElementById(
            'main-paper'
          ),
          `فرم-هزینه-${
            header.date ||
            'بدون-تاریخ'
          }.pdf`,
          'landscape'
        );
      } finally {
        setBusy(false);
      }
    };


  const exportNoInvoice =
    async () => {
      if (!niPages.length)
        return;

      setNiBusy(true);

      try {
        let pdf = null;

        for (
          let i = 0;
          i < niPages.length;
          i++
        ) {
          const node =
            document.getElementById(
              `ni-${i}`
            );

          if (!node)
            continue;

          const canvas =
            await html2canvas(
              node,
              {
                scale: 2.5,
                backgroundColor:
                  '#fff',
                useCORS: true,
                allowTaint: false,
                logging: false
              }
            );

          if (!pdf) {
            pdf =
              new jsPDF({
                orientation:
                  'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
              });
          } else {
            pdf.addPage(
              'a4',
              'portrait'
            );
          }

          const ratio =
            Math.min(
              202 /
                canvas.width,

              289 /
                canvas.height
            );

          const w =
            canvas.width *
            ratio;

          const h =
            canvas.height *
            ratio;

          pdf.addImage(
            canvas.toDataURL(
              'image/jpeg',
              0.96
            ),
            'JPEG',
            (210 - w) / 2,
            (297 - h) / 2,
            w,
            h,
            undefined,
            'FAST'
          );
        }

        if (pdf) {
          pdf.save(
            `فرم-بدون-فاکتور-${
              header.date ||
              'بدون-تاریخ'
            }.pdf`
          );
        }
      } finally {
        setNiBusy(false);
      }
    };


  /* =========================================================
     پاک کردن فرم
     ========================================================= */

  const reset = () => {
    setRows(
      Array.from(
        { length: 8 },
        () => ({
          ...emptyRow(),
          date: header.date
        })
      )
    );

    setHeader(h => ({
      ...h,
      reviewDate: ''
    }));

    setNi(n => ({
      ...n,
      date: header.date,
      requester: '',
      position: '',
      organization: '',
      reason: '',
      approverComment: '',
      notes: ''
    }));

    setSig({
      requester: '',
      confirmer: '',
      issuer: ''
    });
  };


  /* =========================================================
     فرم بدون فاکتور
     ========================================================= */

  const NoInvoice = ({
    items,
    index
  }) => {
    const sum =
      items.reduce(
        (s, item) =>
          s +
          toNum(item.total),
        0
      );

    return (
      <section
        id={`ni-${index}`}
        className="paper no-invoice-paper"
      >
        <div className="ni-frame">

          <div className="ni-top">

            <div className="ni-logo">
              <img
                src={LOGO_SRC}
                alt="فاران"
              />
            </div>

            <div className="ni-title">
              فرم صورت هزینه بدون فاکتور
            </div>

            <div className="ni-code-box">

              <div>
                کد فرم :
                <b>
                  {ni.formCode}
                </b>
              </div>

              <div>
                کد سند مرجع :
                <b>
                  {ni.referenceCode}
                </b>
              </div>

            </div>

          </div>


          <div className="ni-info">

            <div>
              <b>تاریخ :</b>
              <span>
                {ni.date}
              </span>
            </div>

            <div>
              <b>
                نام و نام خانوادگی درخواست کننده :
              </b>

              <span>
                {ni.requester ||
                  '................................'}
              </span>
            </div>

            <div>
              <b>سمت :</b>

              <span>
                {ni.position ||
                  '........................'}
              </span>
            </div>

            <div>
              <b>واحد سازمانی :</b>

              <span>
                {ni.organization ||
                  '........................'}
              </span>
            </div>

            <div className="wide">

              <b>شرح :</b>

              <span>
                {ni.reason ||
                  '................................................................................................'}
              </span>

            </div>

          </div>


          <table className="ni-table">

            <thead>
              <tr>
                <th>ردیف</th>

                <th>
                  مشخصات کالا / خدمات
                </th>

                <th>
                  آدرس ارائه دهنده کالا / خدمات
                </th>

                <th>
                  تعداد
                </th>

                <th>
                  مبلغ واحد
                </th>

                <th>
                  مبلغ کل (ریال)
                </th>
              </tr>
            </thead>


            <tbody>

              {items.map(
                (item, i) => (
                  <tr key={i}>

                    <td>
                      {i + 1}
                    </td>

                    <td>
                      {item.product}
                    </td>

                    <td>
                      {item.provider}
                    </td>

                    <td>
                      {item.qty}
                    </td>

                    <td>
                      {money(
                        item.unit
                      )}
                    </td>

                    <td>
                      {money(
                        item.total
                      )}
                    </td>

                  </tr>
                )
              )}


              {Array.from(
                {
                  length:
                    3 -
                    items.length
                },
                (_, i) => (
                  <tr
                    key={`empty-${i}`}
                  >
                    <td>
                      {items.length +
                        i +
                        1}
                    </td>

                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                )
              )}


              <tr className="ni-total">

                <td colSpan="5">
                  جمع کل (ریال)
                </td>

                <td>
                  {money(sum)}
                </td>

              </tr>

            </tbody>

          </table>


          <div className="ni-bottom">

            {/* =================================================
                درخواست کننده
                ================================================= */}

            <div className="ni-requester">

              <div className="vertical-requester">
                درخواست کننده
              </div>

              <div className="ni-bottom-content">

                <h4>
                  دلیل استفاده از کالا / خدمات
                </h4>

                <div className="reason-text">
                  {ni.reason ||
                    '................................................................................................'}
                </div>


                <div className="signline ni-signature-line">

                  <span>
                    امضاء درخواست کننده :
                  </span>


                  {/*
                   * اینجا همان امضای تنظیم کننده
                   * مستقیماً کپی می‌شود.
                   *
                   * sig.requester همان PNG
                   * شفاف امضای کشیده شده است.
                   */}

                  {sig.requester ? (
                    <img
                      src={
                        sig.requester
                      }
                      alt="امضاء درخواست کننده"
                      className="ni-signature-image"
                    />
                  ) : null}

                </div>

              </div>

            </div>


            {/* =================================================
                تایید کننده
                ================================================= */}

            <div>

              <h4>
                تایید کننده
              </h4>

              <div>
                اظهار نظر تایید کننده
              </div>

              <div className="reason-text">
                {ni.approverComment ||
                  '................................................................................................'}
              </div>

              <div className="checks">

                <span>
                  □ موافقت میشود
                </span>

                <span>
                  □ موافقت نمیشود
                </span>

              </div>

              <div className="signline">

                امضاء تایید کننده :
                {' '}

                {sig.confirmer}

              </div>

            </div>


            {/* =================================================
                تصویب کننده
                ================================================= */}

            <div>

              <h4>
                تصویب کننده
              </h4>

              <div className="signline">

                امضاء تصویب کننده :
                {' '}

                {sig.issuer}

              </div>

            </div>

          </div>


          <div className="notes">

            <b>
              توضیحات :
            </b>

            {' '}

            {ni.notes ||
              '........................................................................................................................'}

          </div>

        </div>
      </section>
    );
  };


  /* =========================================================
     خروجی صفحه
     ========================================================= */

  return (
    <div className="app-shell">

      <aside className="control-panel no-print">

        <div className="panel-title">
          فرم ثبت هزینه
        </div>

        <div className="panel-subtitle">
          اطلاعات را وارد کنید؛ پیش‌نمایش و خروجی A4 همزمان به‌روزرسانی می‌شود.
        </div>


        {/* سربرگ */}

        <section>

          <h3>
            مشخصات سربرگ فرم اصلی
          </h3>

          <label>
            عنوان فرم

            <input
              value={
                header.title
              }
              onChange={e =>
                setHeader({
                  ...header,
                  title:
                    e.target.value
                })
              }
            />
          </label>


          <div className="control-grid">

            <label>
              کد سند

              <input
                value={
                  header.docCode
                }
                onChange={e =>
                  setHeader({
                    ...header,
                    docCode:
                      e.target.value
                  })
                }
              />
            </label>


            <label>
              کد سند مرجع

              <input
                value={
                  header.serviceCode
                }
                onChange={e =>
                  setHeader({
                    ...header,
                    serviceCode:
                      e.target.value
                  })
                }
              />
            </label>

          </div>


          <div className="control-grid">

            <label>
              تاریخ

              <JalaliDate
                value={
                  header.date
                }
                onChange={
                  updateMainDate
                }
              />
            </label>


            <label>
              تاریخ واریزی

              <JalaliDate
                value={
                  header.reviewDate
                }
                onChange={v =>
                  setHeader({
                    ...header,
                    reviewDate: v
                  })
                }
              />
            </label>

          </div>

        </section>


        {/* ردیف‌ها */}

        <section>

          <h3>
            ردیف‌های هزینه
          </h3>

          <div className="editor-table">

            {rows.map(
              (row, i) => (
                <div
                  className="editor-row"
                  key={i}
                >

                  <b>
                    {i + 1}
                  </b>

                  <JalaliDate
                    value={
                      row.date
                    }
                    onChange={v =>
                      updateRow(
                        i,
                        'date',
                        v
                      )
                    }
                  />

                  <input
                    placeholder="محل مراجعه (بانک / شرکت)"
                    value={
                      row.place
                    }
                    onChange={e =>
                      updateRow(
                        i,
                        'place',
                        e.target.value
                      )
                    }
                  />

                  <select
                    value={
                      row.service
                    }
                    onChange={e =>
                      updateRow(
                        i,
                        'service',
                        e.target.value
                      )
                    }
                  >

                    <option value="">
                      نوع خدمات
                    </option>

                    {SERVICES.map(
                      s => (
                        <option
                          key={s}
                          value={s}
                        >
                          {s}
                        </option>
                      )
                    )}

                  </select>


                  <input
                    placeholder="شماره قرارداد / فاکتور"
                    value={
                      row.invoice
                    }
                    onChange={e =>
                      updateRow(
                        i,
                        'invoice',
                        e.target.value
                      )
                    }
                  />


                  <input
                    className="description-input"
                    placeholder="شرح هزینه"
                    value={
                      row.description
                    }
                    onChange={e =>
                      updateRow(
                        i,
                        'description',
                        e.target.value
                      )
                    }
                  />


                  <input
                    inputMode="numeric"
                    placeholder="مبلغ (ریال)"
                    value={
                      row.amount
                    }
                    onChange={e =>
                      updateRow(
                        i,
                        'amount',
                        e.target.value
                      )
                    }
                  />

                </div>
              )
            )}

          </div>

        </section>


        {/* اطلاعات فرم بدون فاکتور */}

        <section>

          <h3>
            اطلاعات فرم بدون فاکتور
          </h3>

          <div className="control-grid">

            <label>
              کد فرم

              <input
                value={
                  ni.formCode
                }
                onChange={e =>
                  setNi({
                    ...ni,
                    formCode:
                      e.target.value
                  })
                }
              />
            </label>


            <label>
              کد سند مرجع

              <input
                value={
                  ni.referenceCode
                }
                onChange={e =>
                  setNi({
                    ...ni,
                    referenceCode:
                      e.target.value
                  })
                }
              />
            </label>


            <label>
              تاریخ

              <JalaliDate
                value={
                  ni.date
                }
                onChange={v =>
                  setNi({
                    ...ni,
                    date: v
                  })
                }
              />
            </label>


            <label>
              درخواست کننده

              <input
                value={
                  ni.requester
                }
                onChange={e =>
                  setNi({
                    ...ni,
                    requester:
                      e.target.value
                  })
                }
              />
            </label>


            <label>
              سمت

              <input
                value={
                  ni.position
                }
                onChange={e =>
                  setNi({
                    ...ni,
                    position:
                      e.target.value
                  })
                }
              />
            </label>


            <label>
              واحد سازمانی

              <input
                value={
                  ni.organization
                }
                onChange={e =>
                  setNi({
                    ...ni,
                    organization:
                      e.target.value
                  })
                }
              />
            </label>

          </div>


          <label>
            دلیل استفاده از کالا / خدمات

            <input
              value={
                ni.reason
              }
              onChange={e =>
                setNi({
                  ...ni,
                  reason:
                    e.target.value
                })
              }
            />
          </label>


          <label>
            اظهار نظر تایید کننده

            <input
              value={
                ni.approverComment
              }
              onChange={e =>
                setNi({
                  ...ni,
                  approverComment:
                    e.target.value
                })
              }
            />
          </label>


          <label>
            توضیحات

            <input
              value={
                ni.notes
              }
              onChange={e =>
                setNi({
                  ...ni,
                  notes:
                    e.target.value
                })
              }
            />
          </label>


          <div className="helper">
            شرح‌هایی که شامل تاکسی، بلیط، ناهار، هتل، سوخت و موارد تعریف‌شده باشند، با مبلغ به فرم بدون فاکتور منتقل می‌شوند. هر فرم ۳ ردیف دارد.
          </div>

        </section>


        {/* =================================================
            امضاها
            ================================================= */}

        <section>

          <h3>
            امضاها
          </h3>

          <div className="control-grid three">

            {/* تنظیم کننده */}

            <div className="signature-control">

              <label>
                تنظیم کننده
              </label>

              <SignaturePad
                value={
                  sig.requester
                }
                onChange={value =>
                  setSig(prev => ({
                    ...prev,
                    requester:
                      value
                  }))
                }
              />

            </div>


            {/* تایید کننده */}

            <label>

              تایید کننده

              <input
                value={
                  sig.confirmer
                }
                onChange={e =>
                  setSig(prev => ({
                    ...prev,
                    confirmer:
                      e.target.value
                  }))
                }
              />

            </label>


            {/* تصویب کننده */}

            <label>

              تصویب کننده

              <input
                value={
                  sig.issuer
                }
                onChange={e =>
                  setSig(prev => ({
                    ...prev,
                    issuer:
                      e.target.value
                  }))
                }
              />

            </label>

          </div>

        </section>


        {/* دکمه‌ها */}

        <div className="action-grid">

          <button
            onClick={() =>
              window.print()
            }
          >
            🖨 چاپ همه فرم‌ها
          </button>


          <button
            onClick={
              exportMain
            }
            disabled={busy}
          >
            {busy
              ? 'در حال ساخت…'
              : '📄 PDF فرم اصلی'}
          </button>


          <button
            onClick={
              exportNoInvoice
            }
            disabled={
              niBusy ||
              !niPages.length
            }
          >
            {niBusy
              ? 'در حال ساخت…'
              : '📄 PDF بدون فاکتور'}
          </button>


          <button
            className="secondary"
            onClick={reset}
          >
            پاک کردن اطلاعات
          </button>

        </div>

      </aside>


      {/* =================================================
          پیش‌نمایش
          ================================================= */}

      <main className="preview-area">

        <div className="preview-note no-print">
          پیش‌نمایش فرم اصلی
        </div>


        {/* فرم اصلی */}

        <section
          id="main-paper"
          className="paper main-paper"
        >

          <div className="form-frame">

            <header className="main-header">

              <div className="header-codes">

                <div>
                  کد سند :
                  <b>
                    {header.docCode}
                  </b>
                </div>

                <div>
                  کد سند مرجع :
                  <b>
                    {header.serviceCode}
                  </b>
                </div>

                <div>
                  تاریخ :
                  <b>
                    {header.date}
                  </b>
                </div>

              </div>


              <div className="header-title">
                {header.title}
              </div>


              <div className="header-logo">

                <img
                  src={LOGO_SRC}
                  alt="فاران"
                />

              </div>

            </header>


            <table className="expense-table">

              <thead>

                <tr>

                  <th>ردیف</th>

                  <th>تاریخ</th>

                  <th>
                    محل مراجعه
                    <br />
                    (بانک / شرکت)
                  </th>

                  <th>
                    نوع خدمات
                  </th>

                  <th>
                    شماره قرارداد / فاکتور
                  </th>

                  <th>
                    شرح هزینه
                  </th>

                  <th>
                    مبلغ هزینه (ریال)
                  </th>

                </tr>

              </thead>


              <tbody>

                {rows.map(
                  (row, i) => (
                    <tr key={i}>

                      <td>
                        {i + 1}
                      </td>

                      <td>
                        {row.date}
                      </td>

                      <td>
                        {row.place}
                      </td>

                      <td>
                        {row.service}
                      </td>

                      <td>
                        {row.invoice}
                      </td>

                      <td className="description-cell">
                        {row.description}
                      </td>

                      <td className="amount-cell">
                        {money(
                          row.amount
                        )}
                      </td>

                    </tr>
                  )
                )}


                <tr className="total-row">

                  <td
                    colSpan="2"
                    className="total-date"
                  >
                    تاریخ واریزی :
                    {' '}
                    {header.reviewDate ||
                      '………………'}
                  </td>

                  <td
                    colSpan="4"
                    className="total-label"
                  >
                    جمع کل هزینه :
                  </td>

                  <td>
                    {money(total)}
                  </td>

                </tr>

              </tbody>

            </table>


            {/* امضاهای فرم اصلی */}

            <div className="signature-row">

              {/* تنظیم کننده */}

              <div>

                <b>
                  نام و امضاء
                </b>

                <span>
                  تنظیم کننده :
                </span>

                <strong className="signature-display">

                  {sig.requester && (
                    <img
                      src={
                        sig.requester
                      }
                      alt="امضاء تنظیم کننده"
                    />
                  )}

                </strong>

              </div>


              {/* تایید کننده */}

              <div>

                <b>
                  نام و امضاء
                </b>

                <span>
                  تایید کننده :
                </span>

                <strong>
                  {sig.confirmer}
                </strong>

              </div>


              {/* تصویب کننده */}

              <div>

                <b>
                  نام و امضاء
                </b>

                <span>
                  تصویب کننده :
                </span>

                <strong>
                  {sig.issuer}
                </strong>

              </div>

            </div>

          </div>

        </section>


        {/* فرم‌های بدون فاکتور */}

        {niPages.length > 0 && (
          <>

            <div className="preview-note no-print">
              پیش‌نمایش فرم‌های هزینه بدون فاکتور
            </div>

            <div className="no-invoice-pages">

              {niPages.map(
                (items, i) => (
                  <NoInvoice
                    key={i}
                    items={items}
                    index={i}
                  />
                )
              )}

            </div>

          </>
        )}

      </main>

    </div>
  );
}


createRoot(
  document.getElementById('root')
).render(
  <App />
);
