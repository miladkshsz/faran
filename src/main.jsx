import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import "./styles.css";

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

const SERVICES = [
  "pm",
  "نصب اولیه",
  "بازدید فروش",
  "بازدید فنی",
  "اعلام خرابی رفاه",
  "اعلام خرابی مشتری",
];

const KEYWORDS = [
  "تاکسی", "ناهار", "صبحانه", "شام", "پذیرایی", "پارکینگ",
  "بنزین", "سوخت", "بلیط", "بلیت", "اقامت", "هتل",
  "مترو", "اتوبوس", "اسنپ", "تپسی",
];

const MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

const WEEKDAYS = [
  "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه",
  "چهارشنبه", "پنجشنبه", "جمعه",
];

const emptyRow = () => ({
  place: "",
  service: "",
  invoice: "",
  description: "",
  amount: "",
});

const toNum = (value) =>
  Number(
    String(value ?? "")
      .replace(/[,٬\s]/g, "")
      .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
  ) || 0;

const money = (value) => {
  const n = toNum(value);
  return n ? new Intl.NumberFormat("fa-IR").format(n) : "";
};

const hasKeyword = (value) => {
  const text = String(value || "").toLowerCase();
  return KEYWORDS.some((keyword) => text.includes(keyword));
};

const chunks = (array, size) =>
  Array.from(
    { length: Math.ceil(array.length / size) },
    (_, index) => array.slice(index * size, index * size + size)
  );

function jalaliToGregorian(jy, jm, jd) {
  let jy2 = jy + 1595;
  let days =
    -355668 +
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const gd = days + 1;
  const leap = gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  let gm = 1;
  let day = gd;
  while (gm <= 12 && day > monthDays[gm - 1]) {
    day -= monthDays[gm - 1];
    gm++;
  }

  return { gy, gm, gd: day };
}

const parseJalali = (value) => {
  const match = String(value || "").match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  return match
    ? { y: +match[1], m: +match[2], d: +match[3] }
    : { y: 1404, m: 1, d: 1 };
};

const monthLength = (year, month) => {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return year % 4 === 3 ? 30 : 29;
};

const pad = (n) => String(n).padStart(2, "0");
const makeDate = (y, m, d) => `${y}/${pad(m)}/${pad(d)}`;

function JalaliDate({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const p = parseJalali(value);
    return { y: p.y, m: p.m };
  });
  const ref = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const p = parseJalali(value);
    setView({ y: p.y, m: p.m });
  }, [value]);

  const selected = parseJalali(value);
  const first = jalaliToGregorian(view.y, view.m, 1);
  const firstWeekday = new Date(first.gy, first.gm - 1, first.gd).getDay();
  const start = (firstWeekday + 1) % 7;
  const days = monthLength(view.y, view.m);
  const cells = Array.from({ length: start + days }, (_, i) => (i < start ? null : i - start + 1));

  const changeMonth = (delta) => {
    let m = view.m + delta;
    let y = view.y;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setView({ y, m });
  };

  return (
    <div className="jalali-date" ref={ref}>
      <button type="button" className="jalali-input" onClick={() => setOpen((v) => !v)}>
        <span className={value ? "has-value" : ""}>{value || "تاریخ شمسی"}</span>
        <span className="calendar-icon">📅</span>
      </button>
      {open && (
        <div className="jalali-calendar" dir="rtl">
          <div className="jalali-calendar-head">
            <button type="button" onClick={() => changeMonth(1)}>‹</button>
            <strong>{MONTHS[view.m - 1]} {view.y}</strong>
            <button type="button" onClick={() => changeMonth(-1)}>›</button>
          </div>
          <div className="jalali-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="jalali-days">
            {cells.map((day, index) => day ? (
              <button
                key={index}
                type="button"
                className={selected.y === view.y && selected.m === view.m && selected.d === day ? "selected" : ""}
                onClick={() => { onChange(makeDate(view.y, view.m, day)); setOpen(false); }}
              >{day}</button>
            ) : <span key={index} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function SignaturePad({ value, onChange, className = "" }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!value) return;
    const image = new Image();
    image.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); };
    image.src = value;
  }, [value]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const down = (event) => {
    event.preventDefault();
    try { canvasRef.current.setPointerCapture(event.pointerId); } catch {}
    drawingRef.current = true;
    lastPointRef.current = getPoint(event);
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const point = getPoint(event);
    const last = lastPointRef.current;
    if (!last) { lastPointRef.current = point; return; }
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(point.x, point.y);
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#000"; ctx.stroke();
    lastPointRef.current = point;
  };

  const up = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
    lastPointRef.current = null;
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  const clear = (event) => {
    event.stopPropagation();
    canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onChange("");
  };

  return (
    <div className={`signature-pad-wrap ${className}`}>
      <canvas ref={canvasRef} width={500} height={150} className="signature-pad" onPointerDown={down} onPointerMove={draw} onPointerUp={up} onPointerCancel={up} />
      <button type="button" className="signature-clear no-print" onClick={clear}>پاک کردن امضا</button>
    </div>
  );
}

/* ===== چاپ جدید: دو صفحه مستقل A4 با اندازه واقعی ===== */
function PrintHeader({ title, docCode, serviceCode, date }) {
  return (
    <header className="print-header">
      <div className="print-codes">
        <div>کد سند : <b>{docCode}</b></div>
        <div>کد سند مرجع : <b>{serviceCode}</b></div>
        <div>تاریخ : <b>{date || "................"}</b></div>
      </div>
      <div className="print-title">{title}</div>
      <div className="print-logo"><img src={LOGO_SRC} alt="فاران" /></div>
    </header>
  );
}

function MainPrintPage({ header, rows, total, signatures }) {
  return (
    <section id="main-paper" className="print-page print-main-page" dir="rtl">
      <div className="print-main-inner">
        <PrintHeader title={header.title} docCode={header.docCode} serviceCode={header.serviceCode} date={header.date} />
        <table className="print-main-table">
          <colgroup>
            <col className="c-no" /><col className="c-date" /><col className="c-place" />
            <col className="c-service" /><col className="c-invoice" /><col className="c-description" /><col className="c-amount" />
          </colgroup>
          <thead><tr>
            <th>ردیف</th><th>تاریخ</th><th>محل مراجعه<br />(بانک / شرکت)</th><th>نوع خدمات</th>
            <th>شماره قرارداد / فاکتور</th><th>شرح هزینه</th><th>مبلغ هزینه<br />(ریال)</th>
          </tr></thead>
          <tbody>
            {rows.map((row, index) => <tr key={index}>
              <td>{index + 1}</td><td>{header.date}</td><td>{row.place}</td><td>{row.service}</td>
              <td>{row.invoice}</td><td className="print-description">{row.description}</td><td>{money(row.amount)}</td>
            </tr>)}
            <tr className="print-total-row">
              <td colSpan="2">تاریخ واریزی : {header.reviewDate || "................"}</td>
              <td colSpan="4">جمع کل هزینه :</td><td>{money(total)}</td>
            </tr>
          </tbody>
        </table>
        <div className="print-main-signatures">
          <div><b>نام و امضاء</b><span>تنظیم کننده :</span>{signatures.requester && <img src={signatures.requester} alt="امضاء تنظیم کننده" />}</div>
          <div><b>نام و امضاء</b><span>تأیید کننده :</span>{signatures.confirmer && <strong>{signatures.confirmer}</strong>}</div>
          <div><b>نام و امضاء</b><span>تصویب کننده :</span>{signatures.issuer && <strong>{signatures.issuer}</strong>}</div>
        </div>
      </div>
    </section>
  );
}

function NoInvoicePrintPage({ items, index, ni, signature }) {
  const total = items.reduce((sum, item) => sum + toNum(item.total), 0);
  return (
    <section id={`ni-${index}`} className="print-page print-no-invoice-page" dir="rtl">
      <div className="print-noinvoice-inner">
        <PrintHeader title="فرم صورت هزینه بدون فاکتور" docCode={ni.formCode} serviceCode={ni.referenceCode} date={ni.date} />
        <div className="ni-request-info">
          <div><b>تاریخ :</b> {ni.date}</div>
          <div><b>نام و نام خانوادگی درخواست کننده :</b> {ni.requester || "................................"}</div>
          <div><b>سمت :</b> {ni.position || "........................"}</div>
          <div><b>واحد سازمانی :</b> {ni.organization || "........................"}</div>
          <div className="full"><b>شرح :</b> {ni.reason || "................................................................................................"}</div>
        </div>
        <table className="print-noinvoice-table">
          <colgroup>
            <col className="ni-no" /><col className="ni-product" /><col className="ni-provider" />
            <col className="ni-qty" /><col className="ni-unit" /><col className="ni-total-col" />
          </colgroup>
          <thead><tr>
            <th>ردیف</th><th>مشخصات کالا / خدمات</th><th>آدرس ارائه دهنده کالا / خدمات</th>
            <th>تعداد</th><th>مبلغ واحد</th><th>مبلغ کل (ریال)</th>
          </tr></thead>
          <tbody>
            {items.map((item, i) => <tr key={i}>
              <td>{i + 1}</td><td className="print-description">{item.product}</td><td className="print-description">{item.provider}</td>
              <td>{item.qty}</td><td>{money(item.unit)}</td><td>{money(item.total)}</td>
            </tr>)}
            {Array.from({ length: 3 - items.length }, (_, i) => <tr key={`empty-${i}`}>
              <td>{items.length + i + 1}</td><td /><td /><td /><td /><td />
            </tr>)}
            <tr className="print-noinvoice-total"><td colSpan="5">جمع کل (ریال)</td><td>{money(total)}</td></tr>
          </tbody>
        </table>
        <div className="print-noinvoice-bottom">
          <div className="print-ni-requester">
            <div className="vertical-requester">درخواست کننده</div>
            <div className="print-ni-content">
              <h4>دلیل استفاده از کالا / خدمات</h4>
              <div className="reason-text">{ni.reason || "................................................................................................"}</div>
              <div className="print-sign-line"><span>امضاء درخواست کننده :</span>{signature.requester && <img src={signature.requester} alt="امضاء درخواست کننده" />}</div>
            </div>
          </div>
          <div className="print-ni-column">
            <h4>تأیید کننده</h4>
            <div>اظهار نظر تأیید کننده</div>
            <div className="reason-text">{ni.approverComment || "................................................................................................"}</div>
            <div className="checks"><span>□ موافقت می‌شود</span><span>□ موافقت نمی‌شود</span></div>
            <div className="print-sign-line">امضاء تأیید کننده : {signature.confirmer}</div>
          </div>
          <div className="print-ni-column">
            <h4>تصویب کننده</h4>
            <div className="reason-text">نام و امضاء</div>
            <div className="print-sign-line">امضاء تصویب کننده : {signature.issuer}</div>
          </div>
        </div>
        <div className="print-notes"><b>توضیحات :</b> {ni.notes || "........................................................................................................................"}</div>
      </div>
    </section>
  );
}

async function canvasToPdfPage(element, orientation) {
  const canvas = await html2canvas(element, { scale: 3, backgroundColor: "#fff", useCORS: true, allowTaint: false, logging: false });
  return { canvas, width: orientation === "landscape" ? 297 : 210, height: orientation === "landscape" ? 210 : 297 };
}

function App() {
  const [header, setHeader] = useState({ title: "فرم صورت ریز هزینه های تنخواه واحد خدمات", docCode: "FI-B-FO-112/00", serviceCode: "FI-B-RE-001/00", date: "1404/05/27", reviewDate: "" });
  const [rows, setRows] = useState(() => Array.from({ length: 8 }, emptyRow));
  const [ni, setNi] = useState({ formCode: "FI-B-FO-135/00", referenceCode: "FI-B-RE-001/00", date: "1404/05/27", requester: "", position: "", organization: "", reason: "", approverComment: "", notes: "" });
  const [sig, setSig] = useState({ requester: "", confirmer: "", issuer: "" });
  const [busy, setBusy] = useState(false);
  const [niBusy, setNiBusy] = useState(false);

  const total = useMemo(() => rows.reduce((sum, row) => sum + toNum(row.amount), 0), [rows]);
  const niItems = useMemo(() => rows.filter((row) => toNum(row.amount) > 0 && String(row.description || "").trim() && hasKeyword(row.description)).map((row) => ({ product: String(row.description).trim(), provider: row.place || "", qty: "1", unit: row.amount, total: row.amount, date: header.date })), [rows, header.date]);
  const niPages = useMemo(() => chunks(niItems, 3), [niItems]);

  const updateRow = (index, key, value) => setRows((prev) => prev.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const updateMainDate = (value) => { setHeader((prev) => ({ ...prev, date: value })); setNi((prev) => ({ ...prev, date: value })); };

  const exportMain = async () => {
    setBusy(true);
    try {
      const { canvas, width, height } = await canvasToPdfPage(document.getElementById("main-paper"), "landscape");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, width, height, undefined, "FAST");
      pdf.save(`فرم-هزینه-${header.date || "بدون-تاریخ"}.pdf`);
    } finally { setBusy(false); }
  };

  const exportNoInvoice = async () => {
    if (!niPages.length) return;
    setNiBusy(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      for (let i = 0; i < niPages.length; i++) {
        const { canvas, width, height } = await canvasToPdfPage(document.getElementById(`ni-${i}`), "portrait");
        if (i > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, width, height, undefined, "FAST");
      }
      pdf.save(`فرم-بدون-فاکتور-${header.date || "بدون-تاریخ"}.pdf`);
    } finally { setNiBusy(false); }
  };

  const reset = () => {
    setRows(Array.from({ length: 8 }, emptyRow));
    setHeader((prev) => ({ ...prev, reviewDate: "" }));
    setNi((prev) => ({ ...prev, date: header.date, requester: "", position: "", organization: "", reason: "", approverComment: "", notes: "" }));
    setSig({ requester: "", confirmer: "", issuer: "" });
  };

  return (
    <div className="app-shell">
      <aside className="control-panel no-print">
        <div className="panel-title">فرم ثبت هزینه</div>
        <div className="panel-subtitle">اطلاعات را وارد کنید؛ پیش‌نمایش و خروجی A4 همزمان به‌روزرسانی می‌شود.</div>
        <section>
          <h3>مشخصات سربرگ فرم اصلی</h3>
          <label>عنوان فرم<input value={header.title} onChange={(e) => setHeader({ ...header, title: e.target.value })}/></label>
          <div className="control-grid">
            <label>کد سند<input value={header.docCode} onChange={(e) => setHeader({ ...header, docCode: e.target.value })}/></label>
            <label>کد سند مرجع<input value={header.serviceCode} onChange={(e) => setHeader({ ...header, serviceCode: e.target.value })}/></label>
          </div>
          <div className="control-grid">
            <label>تاریخ<JalaliDate value={header.date} onChange={updateMainDate}/></label>
            <label>تاریخ واریزی<JalaliDate value={header.reviewDate} onChange={(value) => setHeader({ ...header, reviewDate: value })}/></label>
          </div>
        </section>
        <section>
          <h3>ردیف‌های هزینه</h3>
          <div className="editor-table">
            {rows.map((row, i) => <div className="editor-row" style={{ gridTemplateColumns: "28px repeat(5, minmax(0, 1fr))" }} key={i}>
              <b>{i + 1}</b>
              <input placeholder="محل مراجعه (بانک / شرکت)" value={row.place} onChange={(e) => updateRow(i, "place", e.target.value)}/>
              <select value={row.service} onChange={(e) => updateRow(i, "service", e.target.value)}><option value="">نوع خدمات</option>{SERVICES.map((service) => <option key={service} value={service}>{service}</option>)}</select>
              <input placeholder="شماره قرارداد / فاکتور" value={row.invoice} onChange={(e) => updateRow(i, "invoice", e.target.value)}/>
              <input className="description-input" placeholder="شرح هزینه (مثلاً: تاکسی، ناهار، هتل)" value={row.description} onChange={(e) => updateRow(i, "description", e.target.value)}/>
              <input inputMode="numeric" placeholder="مبلغ (ریال)" value={row.amount} onChange={(e) => updateRow(i, "amount", e.target.value)}/>
            </div>)}
          </div>
          <div className="helper">شرح‌هایی که شامل تاکسی، بلیط، ناهار، هتل، سوخت، پارکینگ، صبحانه، شام، اقامت، مترو، اتوبوس، پذیرایی، اسنپ یا تپسی باشند، خودکار به فرم بدون فاکتور منتقل می‌شوند.</div>
        </section>
        <section>
          <h3>اطلاعات فرم بدون فاکتور</h3>
          <div className="control-grid">
            <label>کد فرم<input value={ni.formCode} onChange={(e) => setNi({ ...ni, formCode: e.target.value })}/></label>
            <label>کد سند مرجع<input value={ni.referenceCode} onChange={(e) => setNi({ ...ni, referenceCode: e.target.value })}/></label>
            <label>تاریخ<JalaliDate value={header.date} onChange={updateMainDate}/></label>
            <label>درخواست کننده<input value={ni.requester} onChange={(e) => setNi({ ...ni, requester: e.target.value })}/></label>
            <label>سمت<input value={ni.position} onChange={(e) => setNi({ ...ni, position: e.target.value })}/></label>
            <label>واحد سازمانی<input value={ni.organization} onChange={(e) => setNi({ ...ni, organization: e.target.value })}/></label>
          </div>
          <label>دلیل استفاده از کالا / خدمات<input value={ni.reason} onChange={(e) => setNi({ ...ni, reason: e.target.value })}/></label>
          <label>اظهار نظر تأیید کننده<input value={ni.approverComment} onChange={(e) => setNi({ ...ni, approverComment: e.target.value })}/></label>
          <label>توضیحات<input value={ni.notes} onChange={(e) => setNi({ ...ni, notes: e.target.value })}/></label>
        </section>
        <section>
          <h3>امضاها</h3>
          <div className="control-grid three">
            <div className="signature-control"><label>تنظیم کننده</label><SignaturePad value={sig.requester} onChange={(value) => setSig((prev) => ({ ...prev, requester: value }))}/></div>
            <label>تأیید کننده<input value={sig.confirmer} onChange={(e) => setSig((prev) => ({ ...prev, confirmer: e.target.value }))}/></label>
            <label>تصویب کننده<input value={sig.issuer} onChange={(e) => setSig((prev) => ({ ...prev, issuer: e.target.value }))}/></label>
          </div>
        </section>
        <div className="action-grid">
          <button onClick={() => window.print()}>🖨 چاپ همه فرم‌ها</button>
          <button onClick={exportMain} disabled={busy}>{busy ? "در حال ساخت…" : "📄 PDF فرم اصلی"}</button>
          <button onClick={exportNoInvoice} disabled={niBusy || !niPages.length}>{niBusy ? "در حال ساخت…" : `📄 PDF بدون فاکتور${niPages.length ? ` (${niPages.length})` : ""}`}</button>
          <button className="secondary" onClick={reset}>پاک کردن اطلاعات</button>
        </div>
      </aside>

      <main className="preview-area">
        <div className="preview-note no-print">پیش‌نمایش فرم اصلی</div>
        <MainPrintPage header={header} rows={rows} total={total} signatures={sig}/>
        {niPages.length > 0 && <>
          <div className="preview-note no-print">پیش‌نمایش فرم‌های هزینه بدون فاکتور ({niPages.length} صفحه)</div>
          <div className="no-invoice-pages">{niPages.map((items, index) => <NoInvoicePrintPage key={index} items={items} index={index} ni={ni} signature={sig}/>)}</div>
        </>}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
