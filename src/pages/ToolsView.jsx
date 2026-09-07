import React, { useState, useMemo } from 'react';

/* ===================== 계산기 설정 (부가세 / 마진 / 3.3% / 손익분기 / ROAS) ===================== */
const toolConfigs = {
    '부가세 계산기': {
        emoji: '🧾',
        bg: '#E7A6A0',
        summary: '매출·매입으로 부가세 계산',
        desc: '입력한 금액이 공급가액인지, 부가세가 포함된 합계금액인지 선택하면 나머지 금액을 자동으로 계산합니다.',
        fields: [
            { type: 'toggle', id: 'vatMode', label: '이 금액은', default: 'supply', options: [{ value: 'supply', label: '공급가액' }, { value: 'total', label: '합계금액(부가세포함)' }] },
            { type: 'number', id: 'amount', label: '금액', default: 1000000 },
        ],
        calc(v) {
            let supply, vat, total;
            if (v.vatMode === 'total') {
                supply = Math.round(v.amount / 1.1);
                vat = v.amount - supply;
                total = v.amount;
            } else {
                supply = v.amount;
                vat = Math.round(v.amount * 0.1);
                total = supply + vat;
            }
            return [
                { label: '공급가액', value: supply },
                { label: '부가세(10%)', value: vat },
                { label: '합계금액', value: total, emphasis: true },
            ];
        },
    },
    '마진 계산기': {
        emoji: '📈',
        bg: '#EBBB8C',
        summary: '원가·판매가로 마진율 확인',
        desc: '원가와 판매가를 입력하면 마진(이익)과 마진율을 계산합니다.',
        fields: [
            { type: 'number', id: 'cost', label: '원가', default: 10000 },
            { type: 'number', id: 'price', label: '판매가', default: 15000 },
        ],
        calc(v) {
            const margin = v.price - v.cost;
            const marginRate = v.price ? (margin / v.price) * 100 : 0;
            const costRate = v.price ? (v.cost / v.price) * 100 : 0;
            return [
                { label: '마진(이익금)', value: margin },
                { label: '마진율', value: marginRate, isPercent: true },
                { label: '원가율', value: costRate, isPercent: true, emphasis: true },
            ];
        },
    },
    '3.3% 계산기': {
        emoji: '💸',
        bg: '#E9D48C',
        summary: '프리랜서 원천징수 계산',
        desc: '프리랜서 원천징수 3.3% 기준으로, 입력한 금액이 세전인지 세후인지에 따라 나머지 금액을 계산합니다.',
        fields: [
            { type: 'toggle', id: 'taxMode', label: '입력 금액 기준', default: 'gross', options: [{ value: 'gross', label: '세전(지급 총액)' }, { value: 'net', label: '세후(실수령액)' }] },
            { type: 'number', id: 'amount', label: '금액', default: 1000000 },
        ],
        calc(v) {
            let gross, withheld, net;
            if (v.taxMode === 'net') {
                net = v.amount;
                gross = Math.round(net / 0.967);
                withheld = gross - net;
            } else {
                gross = v.amount;
                withheld = Math.round(gross * 0.033);
                net = gross - withheld;
            }
            return [
                { label: '원천징수세액(3.3%)', value: withheld },
                { label: '실지급액(세후)', value: net, emphasis: true },
            ];
        },
    },
    '손익분기점': {
        emoji: '⚖️',
        bg: '#A9CB9B',
        summary: '고정비·변동비로 계산',
        desc: '고정비, 개당 판매가, 개당 변동비를 입력하면 손익분기 판매량과 매출액을 계산합니다.',
        fields: [
            { type: 'number', id: 'fixed', label: '고정비(월)', default: 3000000 },
            { type: 'number', id: 'price', label: '개당 판매가', default: 15000 },
            { type: 'number', id: 'variable', label: '개당 변동비', default: 6000 },
        ],
        calc(v) {
            const contribution = v.price - v.variable;
            if (contribution <= 0) {
                return [{ warning: '판매가가 변동비보다 낮거나 같아, 이 가격 구조로는 손익분기점에 도달할 수 없습니다.' }];
            }
            const units = Math.ceil(v.fixed / contribution);
            const revenue = units * v.price;
            return [
                { label: '손익분기 판매량', value: units, unit: '개' },
                { label: '손익분기 매출액', value: revenue, emphasis: true },
            ];
        },
    },
    '광고 ROAS': {
        emoji: '📣',
        bg: '#9DC3E0',
        summary: '광고비 대비 매출 효율 계산',
        desc: '광고비와 그 광고로 발생한 매출을 입력하면 ROAS(광고 수익률)를 계산합니다.',
        fields: [
            { type: 'number', id: 'spend', label: '광고비', default: 500000 },
            { type: 'number', id: 'revenue', label: '광고로 발생한 매출', default: 2000000 },
        ],
        calc(v) {
            const roas = v.spend ? (v.revenue / v.spend) * 100 : 0;
            const multiple = v.spend ? v.revenue / v.spend : 0;
            return [
                { label: 'ROAS', value: roas, isPercent: true, emphasis: true },
                { label: '광고비 대비', value: multiple, isMultiple: true },
            ];
        },
    },
};

const TOOL_ORDER = ['부가세 계산기', '마진 계산기', '3.3% 계산기', '손익분기점', '광고 ROAS'];

function formatValue(line) {
    if (line.isPercent) return line.value.toFixed(1) + '%';
    if (line.isMultiple) return line.value.toFixed(1) + '배';
    if (line.unit) return Math.round(line.value).toLocaleString('ko-KR') + line.unit;
    return Math.round(line.value).toLocaleString('ko-KR') + '원';
}

function defaultValuesFor(config) {
    const v = {};
    config.fields.forEach((f) => { v[f.id] = f.default; });
    return v;
}

const CalculatorModal = ({ toolName, onClose }) => {
    const config = toolConfigs[toolName];
    const [values, setValues] = useState(() => defaultValuesFor(config));

    if (!config) return null;

    const lines = useMemo(() => {
        try {
            return config.calc(values);
        } catch {
            return [];
        }
    }, [config, values]);

    return (
        <div className="fixed inset-0 bg-black/45 z-[200] grid place-items-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-[min(480px,100%)] bg-white border border-black/[0.06] rounded-[28px] p-7 shadow-2xl">
                <h3 className="text-xl font-semibold mb-1.5 text-dark">{toolName}</h3>
                <p className="text-gray-500 text-sm mb-5">{config.desc}</p>
                <div className="grid grid-cols-2 gap-2.5">
                    {config.fields.map((f) => (
                        f.type === 'toggle' ? (
                            <div key={f.id} className="col-span-2">
                                <p className="text-xs text-gray-500 mb-1.5">{f.label}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {f.options.map((o) => (
                                        <button
                                            key={o.value}
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setValues((prev) => ({ ...prev, [f.id]: o.value })); }}
                                            className={`border rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${values[f.id] === o.value ? 'bg-brand text-white border-brand' : 'bg-soft text-gray-500 border-black/10'}`}
                                        >
                                            {o.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <label key={f.id} className="text-xs text-gray-500">
                                {f.label}
                                <input
                                    type="number"
                                    value={values[f.id]}
                                    onChange={(e) => { const n = Number(e.target.value || 0); setValues((prev) => ({ ...prev, [f.id]: n })); }}
                                    className="w-full mt-1.5 border border-black/10 bg-soft text-dark rounded-xl px-3 py-2.5 outline-none"
                                />
                            </label>
                        )
                    ))}
                </div>
                <div className="mt-3.5 bg-soft rounded-2xl p-4 space-y-1.5">
                    {lines[0] && lines[0].warning ? (
                        <p className="text-red-600 font-semibold text-xs leading-relaxed">{lines[0].warning}</p>
                    ) : (
                        lines.map((l, i) => (
                            <div key={i} className={`flex items-center justify-between ${l.emphasis ? 'pt-2 mt-1 border-t border-black/10' : ''}`}>
                                <span className={`text-xs ${l.emphasis ? 'font-semibold text-dark' : 'text-gray-500'}`}>{l.label}</span>
                                <span className={l.emphasis ? 'text-brand font-bold text-base' : 'text-dark font-semibold text-sm'}>{formatValue(l)}</span>
                            </div>
                        ))
                    )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="border-0 rounded-full bg-soft text-dark font-semibold px-4 py-2.5">닫기</button>
                </div>
            </div>
        </div>
    );
};

let quoteRowSeq = 0;
const makeQuoteRow = (item = '', qty = 1, price = 0) => ({ id: quoteRowSeq++, item, qty, price });

const QuoteModal = ({ onClose }) => {
    const [rows, setRows] = useState(() => [makeQuoteRow()]);
    const [copied, setCopied] = useState(false);

    const supply = rows.reduce((sum, r) => sum + (Number(r.qty) || 0) * (Number(r.price) || 0), 0);
    const vat = Math.round(supply * 0.1);
    const total = supply + vat;

    const updateRow = (id, patch) => {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };
    const removeRow = (id) => {
        setRows((prev) => prev.filter((r) => r.id !== id));
    };
    const addRow = () => {
        setRows((prev) => [...prev, makeQuoteRow()]);
    };

    const copyQuote = async () => {
        const lines = ['[견적서]', ''];
        rows.forEach((r) => {
            const item = r.item || '(품목명 없음)';
            const qty = Number(r.qty) || 0;
            const price = Number(r.price) || 0;
            const amount = qty * price;
            lines.push(`- ${item}  ${qty}개 × ${price.toLocaleString('ko-KR')}원 = ${amount.toLocaleString('ko-KR')}원`);
        });
        lines.push('', `공급가액: ${Math.round(supply).toLocaleString('ko-KR')}원`, `부가세(10%): ${vat.toLocaleString('ko-KR')}원`, `합계금액: ${total.toLocaleString('ko-KR')}원`);
        const text = lines.join('\n');
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                throw new Error('clipboard unavailable');
            }
        } catch {
            alert(text);
            return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/45 z-[200] grid place-items-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-[min(640px,100%)] max-h-[85vh] overflow-y-auto bg-white border border-black/[0.06] rounded-[28px] p-7 shadow-2xl">
                <h3 className="text-xl font-semibold mb-1.5 text-dark">견적서 만들기</h3>
                <p className="text-gray-500 text-sm mb-5">품목을 추가하면 공급가액·부가세·합계금액이 자동으로 계산됩니다.</p>

                <div className="border border-black/10 rounded-2xl overflow-hidden mb-3">
                    <div className="grid grid-cols-[1fr_52px_100px_100px_28px] gap-2 bg-soft text-[11px] font-semibold text-gray-500 px-3 py-2">
                        <span>품목</span><span className="text-center">수량</span><span className="text-right">단가</span><span className="text-right">금액</span><span></span>
                    </div>
                    {rows.map((r) => (
                        <div key={r.id} className="grid grid-cols-[1fr_52px_100px_100px_28px] gap-2 items-center px-3 py-2 border-t border-black/[0.06]">
                            <input type="text" value={r.item} placeholder="품목명" onChange={(e) => updateRow(r.id, { item: e.target.value })} className="text-xs outline-none bg-transparent" />
                            <input type="number" value={r.qty} min="0" onChange={(e) => updateRow(r.id, { qty: e.target.value })} className="text-xs text-center outline-none bg-transparent" />
                            <input type="number" value={r.price} min="0" onChange={(e) => updateRow(r.id, { price: e.target.value })} className="text-xs text-right outline-none bg-transparent" />
                            <span className="text-xs text-right font-semibold text-dark">{Math.round((Number(r.qty) || 0) * (Number(r.price) || 0)).toLocaleString('ko-KR')}</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRow(r.id); }} className="text-gray-400 hover:text-red-500 text-sm justify-self-center">✕</button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); addRow(); }} className="text-xs font-semibold text-brand border border-brand/30 rounded-full px-3.5 py-2 hover:bg-brand/5 transition-colors mb-5">+ 품목 추가</button>

                <div className="bg-soft rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-500"><span>공급가액</span><span className="text-dark font-semibold">{Math.round(supply).toLocaleString('ko-KR')}원</span></div>
                    <div className="flex items-center justify-between text-xs text-gray-500"><span>부가세(10%)</span><span className="text-dark font-semibold">{vat.toLocaleString('ko-KR')}원</span></div>
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-black/10"><span className="text-sm font-semibold text-dark">합계금액</span><span className="text-brand font-bold text-base">{total.toLocaleString('ko-KR')}원</span></div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="border-0 rounded-full bg-soft text-dark font-semibold px-4 py-2.5">닫기</button>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyQuote(); }} className="border-0 rounded-full bg-brand text-white font-semibold px-4 py-2.5">{copied ? '복사됨 ✓' : '결과 복사하기'}</button>
                </div>
            </div>
        </div>
    );
};

const ToolsView = ({ onBack }) => {
    const [openTool, setOpenTool] = useState(null);
    const [quoteOpen, setQuoteOpen] = useState(false);

    return (
        <div className="min-h-screen bg-white overflow-y-auto">
            <section className="pt-32 pb-16 md:pt-40 md:pb-20 px-6 relative overflow-hidden" style={{ background: 'radial-gradient(circle at 82% 0%, rgba(0,70,165,.12), transparent 55%), #ffffff' }}>
                <div className="container mx-auto max-w-7xl">
                    <p className="text-[12.5px] text-gray-500 mb-5">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="hover:text-dark transition-colors">홈</button>
                        <span className="mx-1">/</span> 사업도구
                    </p>
                    <p className="text-[13px] font-bold text-brand tracking-wide mb-4">DAILY TOOLS</p>
                    <h1 className="text-[32px] leading-[1.15] md:text-[52px] md:leading-[1.1] font-semibold tracking-tight text-dark break-keep max-w-2xl">매일 쓰는 계산,<br/>가장 빠르게</h1>
                    <p className="mt-5 text-base md:text-lg text-gray-500 max-w-lg break-keep">검색할 때마다 다른 사이트를 돌아다니지 않아도 됩니다. 카드를 눌러 바로 계산해보세요.</p>
                </div>
            </section>

            <section className="pb-10 px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-lg md:text-xl font-semibold text-dark">계산기</h2>
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand text-white text-[11px] font-bold">{TOOL_ORDER.length}</span>
                        </div>
                        <span className="text-xs text-gray-400">지금 바로 계산하기</span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-3 -mx-6 px-6">
                        {TOOL_ORDER.map((name) => {
                            const config = toolConfigs[name];
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenTool(name); }}
                                    className="text-left group shrink-0 w-[220px] hover:-translate-y-1 transition-transform duration-200"
                                >
                                    <div className="relative rounded-2xl overflow-hidden aspect-[4/3] mb-3 grid place-items-center text-5xl" style={{ backgroundColor: config.bg }}>{config.emoji}</div>
                                    <p className="text-sm font-semibold leading-snug text-dark">{name}</p>
                                    <p className="text-xs text-gray-500 mt-1 break-keep">{config.summary}</p>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-8">※ 간단 계산을 돕는 도구이며, 정확한 세무·회계 처리는 전문가 확인을 권장합니다.</p>
                </div>
            </section>

            <section className="pb-20 px-6">
                <div className="container mx-auto max-w-7xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-lg md:text-xl font-semibold text-dark">문서</h2>
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-mint text-white text-[11px] font-bold">1</span>
                        </div>
                        <span className="text-xs text-gray-400">양식을 바로 작성하기</span>
                    </div>
                    <div className="flex gap-4 flex-wrap items-start">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuoteOpen(true); }} className="text-left group shrink-0 w-[220px]">
                            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] mb-3 grid place-items-center text-5xl" style={{ backgroundColor: '#BFA8D9' }}>📝</div>
                            <p className="text-sm font-semibold leading-snug text-dark">견적서 만들기</p>
                            <p className="text-xs text-gray-500 mt-1 break-keep">품목별 견적서 양식 작성</p>
                        </button>
                        <div className="w-[220px] shrink-0 border-2 border-dashed border-black/10 rounded-2xl aspect-[4/3] flex flex-col items-center justify-center text-gray-400 gap-1.5">
                            <span className="text-3xl">＋</span>
                            <span className="text-xs font-medium">준비 중</span>
                        </div>
                    </div>
                </div>
            </section>

            {openTool ? <CalculatorModal toolName={openTool} onClose={() => setOpenTool(null)} /> : null}
            {quoteOpen ? <QuoteModal onClose={() => setQuoteOpen(false)} /> : null}
        </div>
    );
};

export default ToolsView;
