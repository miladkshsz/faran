import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import "./styles.css";

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;
const SERVICES = ["pm", "نصب اولیه", "بازدید فروش", "بازدید فنی", "اعلام خرابی رفاه", "اعلام خرابی مشتری"];
const KEYWORDS = ["تاکسی", "ناهار", "صبحانه", "شام", "پذیرایی", "پارکینگ", "بنزین", "سوخت", "بلیط", "بلیت", "اقامت", "هتل", "مترو", "اتوبوس", "اسنپ", "تپسی"];
const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

const emptyRow = () => ({ place: "", service: "", invoice: "", description: "", amount: "" });
const toNum = (value) => Number(String(value ?? "").replace(/[,٬\s]/g, "").replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))) || 0;
const money = value => { const n = toNum(value); return n ? new Intl.NumberFormat("fa-IR").format(n) : ""; };
const hasKeyword = value => KEYWORDS.some(k => String(value || "").toLowerCase().includes(k));
const chunks = (a, size) => Array.from({ length: Math.ceil(a.length / size) }, (_, i) => a.slice(i * size, i * size + size));

function jalaliToGregorian(jy, jm, jd) {
  let jy2 = jy + 1595;
  let days = -355668 + 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097); days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const gd = days + 1, leap = gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0);
  const md = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1, d = gd; while (gm <= 12 && d > md[gm - 1]) { d -= md[gm - 1]; gm++; }
  return { gy, gm, gd: d };
}
const parseJalali = value => { const m = String(value || "").match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/); return m ? { y: +m[1], m: +m[2], d: +m[3] } : { y: 1404, m: 1, d: 1 }; };
const monthLength = (year, month) => month <= 6 ? 31 : month <= 11 ? 30 : (year % 4 === 3 ? 30 : 29);
const pad = n => String(n).padStart(2, "0");
const makeDate = (y, m, d) => `${y}/${pad(m)}/${pad(d)}`;

function JalaliDate({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => { const p = parseJalali(value); return { y: p.y, m: p.m }; });
  const ref = useRef(null);
  useEffect(() => { const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  useEffect(() => { const p = parseJalali(value); setView({ y: p.y, m: p.m }); }, [value]);
  const selected = parseJalali(value), first = jalaliToGregorian(view.y, view.m, 1), start = (new Date(first.gy, first.gm - 1, first.gd).getDay() + 1) % 7, days = monthLength(view.y, view.m);
  const cells = Array.from({ length: start + days }, (_, i) => i < start ? null : i - start + 1);
  const move = delta => { let m = view.m + delta, y = view.y; if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; } setView({ y, m }); };
  return <div className="jalali-date" ref={ref}><button type="button" className="jalali-input" onClick={() => setOpen(v => !v)}><span className={value ? "has-value" : ""}>{value || "تاریخ شمسی"}</span><span className="calendar-icon">📅</span></button>{open && <div className="jalali-calendar"><div className="jalali-calendar-head"><button type="button" onClick={() => move(1)}>‹</button><strong>{MONTHS[view.m - 1]} {view.y}</strong><button type="button" onClick={() => move(-1)}>›</button></div><div className="jalali-weekdays">{WEEKDAYS.map(d => <span key={d}>{d}</span>)}</div><div className="jalali-days">{cells.map((d, i) => d ? <button key={i} type="button" className={selected.y === view.y && selected.m === view.m && selected.d === d ? "selected" : ""} onClick={() => { onChange(makeDate(view.y, view.m, d)); setOpen(false); }}>{d}</button> : <span key={i}/>)}</div></div>}</div>;
}

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null), drawing = useRef(false), last = useRef(null);
  useEffect(() => { const c = canvasRef.current; if (!c) return; const ctx = c.getContext("2d"); ctx.clearRect(0,0,c.width,c.height); if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img,0,0,c.width,c.height); img.src = value; } }, [value]);
  const point = e => { const r = canvasRef.current.getBoundingClientRect(); return { x:(e.clientX-r.left)*(500/r.width), y:(e.clientY-r.top)*(150/r.height) }; };
  const down = e => { e.preventDefault(); drawing.current=true; last.current=point(e); canvasRef.current.setPointerCapture?.(e.pointerId); };
  const move = e => { if(!drawing.current)return; e.preventDefault(); const p=point(e),l=last.current,ctx=canvasRef.current.getContext("2d"); ctx.beginPath();ctx.moveTo(l.x,l.y);ctx.lineTo(p.x,p.y);ctx.lineWidth=2.2;ctx.lineCap="round";ctx.strokeStyle="#000";ctx.stroke();last.current=p; };
  const up = e => { if(!drawing.current)return; e.preventDefault();drawing.current=false;last.current=null;onChange(canvasRef.current.toDataURL("image/png")); };
  return <div className="signature-pad-wrap"><canvas ref={canvasRef} width="500" height="150" className="signature-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/><button type="button" className="signature-clear no-print" onClick={() => { canvasRef.current.getContext("2d").clearRect(0,0,500,150); onChange(""); }}>پاک کردن امضا</button></div>;
}

function PrintHeader({ title, docCode, serviceCode, date, noInvoice = false }) {
  return <div className={`print-header ${noInvoice ? "noinvoice-header" : ""}`}><div className="print-codes"><div>کد فرم : <b>{docCode}</b></div><div>کد سند مرجع : <b>{serviceCode}</b></div>{!noInvoice && <div>تاریخ : <b>{date || "................"}</b></div>}</div><div className="print-title">{title}</div><div className="print-logo"><img src={LOGO_SRC} alt="فاران"/></div></div>;
}

function MainPrintPage({ header, rows, total, signatures }) {
  return <section id="main-paper" className="print-page print-main-page" dir="rtl"><div className="print-main-inner"><PrintHeader title={header.title} docCode={header.docCode} serviceCode={header.serviceCode} date={header.date}/><table className="print-main-table"><colgroup><col className="c-no"/><col className="c-date"/><col className="c-place"/><col className="c-service"/><col className="c-invoice"/><col className="c-description"/><col className="c-amount"/></colgroup><thead><tr><th>ردیف</th><th>تاریخ</th><th>محل مراجعه<br/>(بانک / شرکت)</th><th>نوع خدمات</th><th>شماره قرارداد / فاکتور</th><th>شرح هزینه</th><th>مبلغ هزینه<br/>(ریال)</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{i+1}</td><td>{header.date}</td><td>{r.place}</td><td>{r.service}</td><td>{r.invoice}</td><td className="print-description">{r.description}</td><td>{money(r.amount)}</td></tr>)}<tr className="print-total-row"><td colSpan="2">تاریخ واریزی : {header.reviewDate || "................"}</td><td colSpan="4">جمع کل هزینه :</td><td>{money(total)}</td></tr></tbody></table><div className="print-main-signatures"><div><b>نام و امضاء</b><span>تنظیم کننده :</span>{signatures.requester && <img src={signatures.requester} alt="امضاء"/>}</div><div><b>نام و امضاء</b><span>تأیید کننده :</span><strong>{signatures.confirmer}</strong></div><div><b>نام و امضاء</b><span>تصویب کننده :</span><strong>{signatures.issuer}</strong></div></div></div></section>;
}

function NoInvoicePrintPage({ items, index, ni, signature }) {
  const total = items.reduce((s,r)=>s+toNum(r.total),0);
  return <section id={`ni-${index}`} className="print-page print-no-invoice-page" dir="rtl"><div className="noinvoice-sheet"><PrintHeader title="فرم صورت هزینه بدون فاکتور" docCode={ni.formCode} serviceCode={ni.referenceCode} date={ni.date} noInvoice/><div className="ni-date-row">تاریخ : <b>{ni.date || "................"}</b></div><div className="ni-request-row"><span>نام و نام خانوادگی درخواست کننده : {ni.requester || "................................................"}</span><span>واحد سازمانی : {ni.organization || "................................"}</span></div><table className="ni-reference-table"><colgroup><col/><col/><col/><col/><col/><col/></colgroup><thead><tr><th>ردیف</th><th>مشخصات کالا / خدمات</th><th>آدرس ارائه دهنده کالا / خدمات</th><th>تعداد</th><th>مبلغ واحد (ریال)</th><th>مبلغ کل (ریال)</th></tr></thead><tbody>{items.map((r,i)=><tr key={i}><td>{i+1}</td><td>{r.product}</td><td>{r.provider}</td><td>{r.qty || "۱"}</td><td>{money(r.unit)}</td><td>{money(r.total)}</td></tr>)}{Array.from({length:3-items.length},(_,i)=><tr key={`e${i}`}><td>{items.length+i+1}</td><td/><td/><td/><td/><td/></tr>)}<tr className="ni-total"><td colSpan="5">جمع کل (ریال)</td><td>{money(total)}</td></tr></tbody></table><div className="ni-lower"><div className="ni-requester-block"><div className="vertical-label">درخواست کننده</div><div className="ni-reason"><b>دلیل استفاده از کالا / خدمات :</b><div>{ni.reason || "........................................................................................................................................"}</div><div className="ni-sign"><span>امضاء درخواست کننده</span>{signature.requester && <img src={signature.requester} alt="امضاء"/>}</div></div></div><div className="ni-approver"><b>اظهار نظر تأیید کننده</b><div className="dots">{ni.approverComment || "................................................................................................................"}</div><div className="checks"><span>□ موافقت می‌شود</span><span>□ موافقت نمی‌شود</span></div><div className="ni-sign-text">امضاء تأیید کننده : {signature.confirmer}</div></div><div className="ni-issuer"><b>امضاء تأیید کننده</b><div className="ni-sign-text">نام و امضاء<br/><br/>{signature.issuer}</div></div></div><div className="ni-notes">توضیحات : {ni.notes || "........................................................................................................................................................................"}</div></div></section>;
}

async function makePageCanvas(el) { return html2canvas(el,{scale:3,backgroundColor:"#fff",useCORS:true,allowTaint:false,logging:false}); }

function App(){
 const [header,setHeader]=useState({title:"فرم صورت ریز هزینه های تنخواه واحد خدمات",docCode:"FI-B-FO-112/00",serviceCode:"FI-B-RE-001/00",date:"1404/05/27",reviewDate:""});
 const [rows,setRows]=useState(()=>Array.from({length:8},emptyRow));
 const [ni,setNi]=useState({formCode:"FI-B-FO-135/00",referenceCode:"FI-B-RE-001/00",date:"1404/05/27",requester:"",position:"",organization:"",reason:"",approverComment:"",notes:""});
 const [sig,setSig]=useState({requester:"",confirmer:"",issuer:""}); const [busy,setBusy]=useState(false),[niBusy,setNiBusy]=useState(false);
 const total=useMemo(()=>rows.reduce((s,r)=>s+toNum(r.amount),0),[rows]);
 const niItems=useMemo(()=>rows.filter(r=>toNum(r.amount)>0&&String(r.description||"").trim()&&hasKeyword(r.description)).map(r=>({product:String(r.description).trim(),provider:r.place||"",qty:"1",unit:r.amount,total:r.amount,date:header.date})),[rows,header.date]);
 const niPages=useMemo(()=>chunks(niItems,3),[niItems]);
 const updateRow=(i,k,v)=>setRows(p=>p.map((r,x)=>x===i?{...r,[k]:v}:r));
 const updateDate=v=>{setHeader(p=>({...p,date:v}));setNi(p=>({...p,date:v}));};
 const exportMain=async()=>{setBusy(true);try{const c=await makePageCanvas(document.getElementById("main-paper"));const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});pdf.addImage(c.toDataURL("image/jpeg",.98),"JPEG",0,0,297,210,undefined,"FAST");pdf.save(`فرم-هزینه-${header.date||"بدون-تاریخ"}.pdf`);}finally{setBusy(false)}};
 const exportNoInvoice=async()=>{if(!niPages.length)return;setNiBusy(true);try{const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});for(let i=0;i<niPages.length;i++){const c=await makePageCanvas(document.getElementById(`ni-${i}`));if(i)pdf.addPage("a4","landscape");pdf.addImage(c.toDataURL("image/jpeg",.98),"JPEG",0,0,297,210,undefined,"FAST");}pdf.save(`فرم-بدون-فاکتور-${header.date||"بدون-تاریخ"}.pdf`);}finally{setNiBusy(false)}};
 const reset=()=>{setRows(Array.from({length:8},emptyRow));setHeader(p=>({...p,reviewDate:""}));setNi(p=>({...p,date:header.date,requester:"",position:"",organization:"",reason:"",approverComment:"",notes:""}));setSig({requester:"",confirmer:"",issuer:""});};
 return <div className="app-shell"><aside className="control-panel no-print"><div className="panel-title">فرم ثبت هزینه</div><div className="panel-subtitle">اطلاعات را وارد کنید؛ پیش‌نمایش و خروجی PDF A4 به‌روزرسانی می‌شود.</div><section><h3>مشخصات سربرگ فرم اصلی</h3><label>عنوان فرم<input value={header.title} onChange={e=>setHeader({...header,title:e.target.value})}/></label><div className="control-grid"><label>کد سند<input value={header.docCode} onChange={e=>setHeader({...header,docCode:e.target.value})}/></label><label>کد سند مرجع<input value={header.serviceCode} onChange={e=>setHeader({...header,serviceCode:e.target.value})}/></label></div><div className="control-grid"><label>تاریخ<JalaliDate value={header.date} onChange={updateDate}/></label><label>تاریخ واریزی<JalaliDate value={header.reviewDate} onChange={v=>setHeader({...header,reviewDate:v})}/></label></div></section><section><h3>ردیف‌های هزینه</h3><div className="editor-table">{rows.map((r,i)=><div className="editor-row" key={i}><b>{i+1}</b><input placeholder="محل مراجعه (بانک / شرکت)" value={r.place} onChange={e=>updateRow(i,"place",e.target.value)}/><select value={r.service} onChange={e=>updateRow(i,"service",e.target.value)}><option value="">نوع خدمات</option>{SERVICES.map(s=><option key={s}>{s}</option>)}</select><input placeholder="شماره قرارداد / فاکتور" value={r.invoice} onChange={e=>updateRow(i,"invoice",e.target.value)}/><input placeholder="شرح هزینه" value={r.description} onChange={e=>updateRow(i,"description",e.target.value)}/><input inputMode="numeric" placeholder="مبلغ (ریال)" value={r.amount} onChange={e=>updateRow(i,"amount",e.target.value)}/></div>)}</div></section><section><h3>فرم بدون فاکتور</h3><div className="control-grid"><label>کد فرم<input value={ni.formCode} onChange={e=>setNi({...ni,formCode:e.target.value})}/></label><label>کد سند مرجع<input value={ni.referenceCode} onChange={e=>setNi({...ni,referenceCode:e.target.value})}/></label><label>درخواست کننده<input value={ni.requester} onChange={e=>setNi({...ni,requester:e.target.value})}/></label><label>واحد سازمانی<input value={ni.organization} onChange={e=>setNi({...ni,organization:e.target.value})}/></label></div><label>دلیل استفاده از کالا / خدمات<input value={ni.reason} onChange={e=>setNi({...ni,reason:e.target.value})}/></label><label>اظهار نظر تأیید کننده<input value={ni.approverComment} onChange={e=>setNi({...ni,approverComment:e.target.value})}/></label><label>توضیحات<input value={ni.notes} onChange={e=>setNi({...ni,notes:e.target.value})}/></label></section><section><h3>امضاها</h3><div className="signature-control"><label>درخواست کننده / تنظیم کننده</label><SignaturePad value={sig.requester} onChange={v=>setSig(p=>({...p,requester:v}))}/></div><div className="control-grid"><label>تأیید کننده<input value={sig.confirmer} onChange={e=>setSig(p=>({...p,confirmer:e.target.value}))}/></label><label>تصویب کننده<input value={sig.issuer} onChange={e=>setSig(p=>({...p,issuer:e.target.value}))}/></label></div></section><div className="action-grid"><button onClick={()=>window.print()}>🖨 چاپ همه فرم‌ها</button><button onClick={exportMain} disabled={busy}>{busy?"در حال ساخت…":"📄 PDF فرم اصلی"}</button><button onClick={exportNoInvoice} disabled={niBusy||!niPages.length}>{niBusy?"در حال ساخت…":`📄 PDF بدون فاکتور${niPages.length?` (${niPages.length})`:""}`}</button><button className="secondary" onClick={reset}>پاک کردن اطلاعات</button></div></aside><main className="preview-area"><div className="preview-note no-print">پیش‌نمایش فرم اصلی</div><MainPrintPage header={header} rows={rows} total={total} signatures={sig}/>{niPages.length>0&&<><div className="preview-note no-print">پیش‌نمایش فرم بدون فاکتور ({niPages.length} صفحه)</div><div className="no-invoice-pages">{niPages.map((items,i)=><NoInvoicePrintPage key={i} items={items} index={i} ni={ni} signature={sig}/>)}</div></>}</main></div>;
}
createRoot(document.getElementById("root")).render(<App/>);
