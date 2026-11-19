import React, { useState, useMemo, useEffect } from 'react';
import { Icons } from './Icons';
import ModalPortal from './ModalPortal';
import { getParticipantCountDisplay, getSeminarCapacity, getDisplayedParticipantCurrent, is정모 } from '../utils/seminarDisplay';
import { getEffectiveCapacityLimit } from '../utils/adminHiddenApplications';
import { MgSectionHead } from './mg/Mg';

const CalendarSection = ({ seminars = [], onSelectSeminar, currentUser, onWriteReview, applications = [] }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    
    // ESC 키로 일정 상세 모달 닫기
    useEffect(() => {
        const handleEscKey = (e) => {
            if (e.key === 'Escape' && selectedDate) {
                setSelectedDate(null);
            }
        };
        window.addEventListener('keydown', handleEscKey);
        return () => {
            window.removeEventListener('keydown', handleEscKey);
        };
    }, [selectedDate]);
    
    // seminars가 배열이 아닌 경우 빈 배열로 처리
    const safeSeminars = Array.isArray(seminars) ? seminars : [];
    
    // 접속일 기준 주의 시작일(일요일) 계산
    const getWeekStart = (date) => {
        const d = new Date(date);
        const day = d.getDay(); // 0(일) ~ 6(토)
        const diff = d.getDate() - day; // 일요일로 이동
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - day);
        return weekStart;
    };
    
    // 주의 7일 배열 생성 (useMemo로 메모이제이션)
    const weekDays = useMemo(() => {
        const weekStart = getWeekStart(currentDate);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            days.push(day);
        }
        return days;
    }, [currentDate]);
    
    // 이전/다음 주 이동
    const prevWeek = () => setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    const nextWeek = () => setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
    
    // 날짜 포맷팅 (YYYY.MM.DD)
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
    };
    
    // 시간 추출 함수 (세미나 데이터에서 시간 정보 추출)
    const extractTime = (seminar) => {
        // date 필드에서 시간 정보 추출 시도 (예: "2024.01.15 14:00" 형식)
        if (seminar.date && seminar.date.includes(' ')) {
            const timePart = seminar.date.split(' ')[1];
            if (timePart) {
                const [hours, minutes] = timePart.split(':');
                return { hours: parseInt(hours) || 0, minutes: parseInt(minutes) || 0 };
            }
        }
        // time 필드가 있으면 사용
        if (seminar.time) {
            const [hours, minutes] = seminar.time.split(':');
            return { hours: parseInt(hours) || 0, minutes: parseInt(minutes) || 0 };
        }
        return { hours: 0, minutes: 0 };
    };
    
    // 주 범위 표시 문자열
    const weekRangeText = `${formatDate(weekDays[0])} ~ ${formatDate(weekDays[6])}`;
    
    // 날짜 문자열 또는 객체(Timestamp/Date)를 표준 형식(YYYY.MM.DD)으로 변환하는 함수
    const normalizeDateString = (dateStr) => {
        if (dateStr == null) return null;
        // Firestore Timestamp 또는 Date 객체
        if (typeof dateStr === 'object') {
            const d = typeof dateStr.toDate === 'function' ? dateStr.toDate() : dateStr;
            if (d instanceof Date && !isNaN(d.getTime())) {
                return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
            }
            return null;
        }
        const str = String(dateStr).trim();
        if (!str) return null;
        // 시간 부분 제거 (예: "2024.01.15 14:00" -> "2024.01.15")
        let dateOnly = str;
        if (dateOnly.includes(' ')) {
            dateOnly = dateOnly.split(' ')[0];
        }
        if (dateOnly.includes('T')) {
            dateOnly = dateOnly.split('T')[0];
        }
        // 다양한 구분자 처리 (., -, /)
        dateOnly = dateOnly.replace(/-/g, '.').replace(/\//g, '.');
        const parts = dateOnly.split('.');
        if (parts.length < 3) {
            if (dateOnly.length === 8 && /^\d+$/.test(dateOnly)) {
                return `${dateOnly.substring(0, 4)}.${dateOnly.substring(4, 6)}.${dateOnly.substring(6, 8)}`;
            }
            return null;
        }
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}.${month}.${day}`;
    };
    
    // 특정 날짜의 이벤트 가져오기 (시간대별 정렬)
    const getEventsForDate = (date) => {
        const dateStr = formatDate(date);
        const events = safeSeminars.filter(s => {
            if (!s.date) return false;
            const normalizedDate = normalizeDateString(s.date);
            return normalizedDate === dateStr;
        });
        
        // 시간대별로 정렬
        return events.sort((a, b) => {
            const timeA = extractTime(a);
            const timeB = extractTime(b);
            const totalMinutesA = timeA.hours * 60 + timeA.minutes;
            const totalMinutesB = timeB.hours * 60 + timeB.minutes;
            return totalMinutesA - totalMinutesB;
        });
    };
    
    // 날짜 문자열을 Date 객체로 변환하는 함수
    const parseDateString = (dateStr) => {
        if (!dateStr) return null;
        const normalized = normalizeDateString(dateStr);
        if (!normalized) return null;
        
        // "YYYY.MM.DD" 형식을 Date 객체로 변환
        const parts = normalized.split('.');
        if (parts.length !== 3) return null;
        
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 월은 0부터 시작
        const day = parseInt(parts[2], 10);
        
        return new Date(year, month, day);
    };
    
    // 통계 계산 (이번 주)
    const weekStats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const weekEvents = weekDays.flatMap(date => getEventsForDate(date));
        const totalEvents = weekEvents.length;
        // 진행 중: 전체 프로그램(safeSeminars) 기준 — 날짜가 오늘 이상이고 모집중/마감임박 등
        const ongoingEvents = safeSeminars.filter(s => {
            const eventDate = parseDateString(s.date);
            if (!eventDate) return false;
            eventDate.setHours(0, 0, 0, 0);
            const isFutureOrToday = eventDate >= today;
            const status = s.status || '';
            return isFutureOrToday && (status === '모집중' || status === '마감임박' || (status !== '종료' && status !== '후기작성가능'));
        }).length;
        const endedEvents = weekEvents.filter(ev => {
            const eventDate = parseDateString(ev.date);
            if (!eventDate) return false;
            eventDate.setHours(0, 0, 0, 0);
            const status = ev.status || '';
            return eventDate < today || status === '종료';
        }).length;
        
        return { totalEvents, ongoingEvents, endedEvents };
    }, [weekDays, safeSeminars]);
    const renderCalendarDays = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return weekDays.map((date, index) => {
            const events = getEventsForDate(date);
            const dayOfWeek = date.getDay();
            const isToday = date.toDateString() === today.toDateString();
            const hasEvents = events.length > 0;
            const isPastDate = date < today;
            const dayName = ['일', '월', '화', '수', '목', '금', '토'][dayOfWeek];
            const dayColor = dayOfWeek === 0 ? 'text-red-600' : dayOfWeek === 6 ? 'text-royal' : 'text-ink';
            
            // 먼저가본 개편(2026-11-20): 날짜 칸은 일정 수와 상관없이 같은 높이·같은 여백(표라서 둥글림 0)
            return (
                <div 
                    key={index} 
                    className={`flex h-full min-h-[156px] min-w-0 flex-col border border-line p-3 transition-colors ${isPastDate ? 'bg-card' : 'bg-white'} ${hasEvents ? 'cursor-pointer hover:border-ink' : ''}`}
                    onClick={() => hasEvents && setSelectedDate(date)}
                    {...(hasEvents ? {
                        role: 'button',
                        tabIndex: 0,
                        'aria-label': `${formatDate(date)} ${dayName}요일 일정 ${events.length}개 보기`,
                        onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDate(date); } },
                    } : {})}
                >
                    <div className="flex h-7 items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`text-[13px] font-semibold ${dayOfWeek === 0 ? 'text-red-600' : dayOfWeek === 6 ? 'text-royal' : 'text-sub'}`}>
                                {dayName}
                            </span>
                            <span className={`flex h-7 min-w-[28px] items-center justify-center text-[16px] font-bold ${isToday ? 'bg-royal px-1 text-white' : dayColor} ${isPastDate ? 'opacity-60' : ''}`}>
                                {date.getDate()}
                            </span>
                        </div>
                        {hasEvents && (
                            <span className={`inline-flex h-6 items-center px-2 text-[12px] font-semibold ${isPastDate ? 'bg-white text-sub' : 'bg-sky text-royal'}`}>
                                {events.length}개
                            </span>
                        )}
                    </div>
                    
                    <div className="mt-2.5 flex flex-col gap-1.5">
                        {events.slice(0, 3).map((ev, idx) => {
                            const time = extractTime(ev);
                            const timeStr = time.hours > 0 || time.minutes > 0 
                                ? `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`
                                : '';
                            
                            return (
                                <div 
                                    key={idx} 
                                    className={`flex h-8 min-w-0 items-center gap-1.5 border-l-2 px-2 text-[13px] ${isPastDate ? 'border-line2 bg-white text-sub' : 'border-royal bg-card text-ink'}`}
                                >
                                    {timeStr && (
                                        <span className="shrink-0 text-[12px] font-semibold text-sub">
                                            {timeStr}
                                        </span>
                                    )}
                                    <span className="min-w-0 truncate font-semibold">{ev.title}</span>
                                </div>
                            );
                        })}
                        {events.length > 3 && (
                            <div className="pt-0.5 text-center text-[12px] text-sub">
                                +{events.length - 3}개 더보기
                            </div>
                        )}
                    </div>
                </div>
            );
        });
    };

    const BTN_OFF = 'bg-card text-sub cursor-not-allowed';
    const statCls = 'flex h-full min-h-[112px] min-w-0 flex-col rounded-xl bg-card px-4 pb-4 pt-4 md:px-6';

    return (
        <section className="mt-12" aria-labelledby="calendar-title">
            {/* 머리 줄 */}
            <MgSectionHead
                id="calendar-title"
                title={<span className="inline-flex items-center gap-2"><Icons.Calendar className="text-ink" size={24} aria-hidden="true" /> 프로그램 일정표</span>}
                desc="날짜를 누르면 그날 일정을 자세히 볼 수 있습니다."
                extra={(
                    <div className="flex items-center gap-1.5">
                        <button 
                            type="button"
                            onClick={prevWeek} 
                            aria-label="이전 주"
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line2 bg-white text-ink transition-colors hover:border-ink"
                        >
                            <Icons.ArrowLeft size={18} />
                        </button>
                        <span className="min-w-[188px] px-1 text-center text-[15px] font-semibold text-ink" aria-live="polite">
                            {weekRangeText}
                        </span>
                        <button 
                            type="button"
                            onClick={nextWeek} 
                            aria-label="다음 주"
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line2 bg-white text-ink transition-colors hover:border-ink"
                        >
                            <Icons.ArrowRight size={18} />
                        </button>
                    </div>
                )}
            />
            
            {/* 통계 — 세 칸 같은 높이·같은 여백 */}
            <div className="mb-6 mt-[26px] grid grid-cols-1 gap-2.5 sm:grid-cols-3 md:gap-3">
                <div className={statCls}>
                    <div className="truncate text-[14px] font-semibold text-sub">이번 주 일정</div>
                    <div className="mt-1 text-[28px] font-bold leading-tight text-ink">{weekStats.totalEvents}</div>
                    <div className="mt-auto truncate text-[13px] text-sub">전체 프로그램</div>
                </div>
                <div className={statCls}>
                    <div className="truncate text-[14px] font-semibold text-royal">진행 중</div>
                    <div className="mt-1 text-[28px] font-bold leading-tight text-royal">{weekStats.ongoingEvents}</div>
                    <div className="mt-auto truncate text-[13px] text-sub">모집 중 / 마감임박</div>
                </div>
                <div className={statCls}>
                    <div className="truncate text-[14px] font-semibold text-sub">종료</div>
                    <div className="mt-1 text-[28px] font-bold leading-tight text-ink">{weekStats.endedEvents}</div>
                    <div className="mt-auto truncate text-[13px] text-sub">지난 일정</div>
                </div>
            </div>
            
            {/* 주간 캘린더 — 7칸 같은 높이 */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                {renderCalendarDays()}
            </div>
            {selectedDate && getEventsForDate(selectedDate).length > 0 && (
                <ModalPortal>
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedDate(null); }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="calendar-day-title" className="z-10 flex max-h-[calc(100dvh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] bg-white md:max-h-[calc(90vh-100px)]" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-scroll min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
                            <h4 id="calendar-day-title" className="text-[22px] font-bold text-ink md:text-[24px]">{formatDate(selectedDate)} 프로그램</h4>
                            <p className="mb-6 mt-1 text-[15px] text-sub">시간 순서로 정렬된 일정입니다</p>
                        <ul className="space-y-3">
                            {getEventsForDate(selectedDate).map((ev, idx) => {
                                const time = extractTime(ev);
                                const timeStr = time.hours > 0 || time.minutes > 0 
                                    ? `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`
                                    : '';
                                
                                // 일정 칸: 시간 칸 너비·제목 2줄·설명 3줄 고정 — 글 양과 상관없이 같은 모양
                                return (
                                    <li key={idx} className="rounded-xl border border-line bg-white p-4 md:p-5">
                                        <div className="flex items-start gap-4">
                                            <div className="w-14 shrink-0 text-center">
                                                <div className="text-[12px] font-semibold text-sub">시간</div>
                                                <div className="mt-0.5 text-[16px] font-semibold text-ink">{timeStr || ' '}</div>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-2 flex items-start justify-between gap-3">
                                                    <h5 className="line-clamp-2 min-h-[2.8em] break-keep text-[17px] font-semibold leading-[1.4] text-ink">{ev.title}</h5>
                                                    <span className={`inline-flex h-7 shrink-0 items-center px-2.5 text-[13px] font-semibold ${
                                                        ev.status === '모집중' ? 'bg-royal text-white' : 
                                                        ev.status === '마감임박' ? 'bg-red-600 text-white' : 
                                                        'bg-ink text-white'
                                                    }`}>
                                                        {ev.status}
                                                    </span>
                                                </div>
                                                <div className="mb-3 flex flex-col gap-1.5 text-[15px]">
                                                    <span className="flex min-w-0 items-center gap-2 text-[#333]">
                                                        <Icons.Clock size={15} className="shrink-0 text-sub" aria-hidden="true"/> <span className="truncate">{ev.date}</span>
                                                    </span>
                                                    <span className="flex min-w-0 items-center gap-2 text-[#333]">
                                                        <Icons.MapPin size={15} className="shrink-0 text-sub" aria-hidden="true"/> <span className="truncate">{ev.location || ' '}</span>
                                                    </span>
                                                    <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                                                        <Icons.Users size={15} className="shrink-0 text-royal" aria-hidden="true"/> 신청현황: {(() => {
                                                        const d = getParticipantCountDisplay(ev);
                                                        if (d.mode === 'noCapacity') {
                                                            return (<>{d.current}명</>);
                                                        }
                                                        return (<>{d.current} / {d.max}명</>);
                                                    })()}
                                                    </span>
                                                </div>
                                                <p className="mb-3 line-clamp-3 min-h-[calc(4.875em+24px)] rounded-lg bg-card p-3 text-[15px] leading-relaxed text-[#333]">
                                                    {ev.desc || ' '}
                                                </p>
                                                {!currentUser ? (
                                                    <div className="space-y-1.5">
                                                        <p className="text-center text-[13px] leading-tight text-sub">프로그램 신청은 회원가입 후 가능합니다.</p>
                                                        <button 
                                                            type="button" 
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); alert("프로그램 신청은 회원가입 후 가능합니다. 먼저 로그인해 주세요."); }} 
                                                            className={`h-11 w-full rounded-lg text-[15px] font-bold transition-colors ${BTN_OFF}`} 
                                                            disabled
                                                        >
                                                            로그인 후 신청 가능
                                                        </button>
                                                    </div>
                                                ) : (() => {
                                                    const getFeeLabel = (e) => {
                                                        const fee = e.applicationFee != null ? Number(e.applicationFee) : 0;
                                                        const price = e.price != null ? Number(e.price) : 0;
                                                        const isPaid = fee > 0 || (e.requiresPayment && price > 0);
                                                        const amount = fee > 0 ? fee : price;
                                                        return isPaid ? (amount > 0 ? `${amount.toLocaleString()}원` : '유료') : '무료';
                                                    };
                                                    const isEventEnded = (e) => {
                                                        if (!e?.date) return false;
                                                        const s = String(e.date).trim();
                                                        const match = s.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
                                                        if (!match) return true;
                                                        const eventDate = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
                                                        eventDate.setHours(23, 59, 59, 999);
                                                        return eventDate.getTime() <= Date.now();
                                                    };
                                                    const getButtonConfig = () => {
                                                        if (ev.status === '종료') {
                                                            return { text: '종료된 일정', disabled: true, onClick: null, className: BTN_OFF };
                                                        }
                                                        if (ev.status === '후기작성가능') {
                                                            if (!isEventEnded(ev)) {
                                                                return { text: '종료 후 후기 작성', disabled: true, onClick: null, className: BTN_OFF };
                                                            }
                                                            const hasApplied = applications?.some(app => 
                                                                String(app.seminarId) === String(ev.id) && String(app.userId) === String(currentUser?.id)
                                                            );
                                                            if (hasApplied) {
                                                                return { 
                                                                    text: '후기쓰기', 
                                                                    disabled: false, 
                                                                    onClick: () => { onWriteReview && onWriteReview(ev); setSelectedDate(null); },
                                                                    className: 'bg-[#1a1a1a] text-white hover:bg-black'
                                                                };
                                                            }
                                                            return { text: '참여자만', disabled: true, onClick: null, className: BTN_OFF };
                                                        }
                                                        const current = getDisplayedParticipantCurrent(ev);
                                                        const limit = getEffectiveCapacityLimit(ev);
                                                        if (Number.isFinite(limit) && current >= limit) {
                                                            return { text: '정원 마감', disabled: true, onClick: null, className: BTN_OFF };
                                                        }
                                                        return { 
                                                            text: '참여신청', 
                                                            disabled: false, 
                                                            onClick: () => { onSelectSeminar(ev); setSelectedDate(null); },
                                                            className: 'bg-royal text-white hover:bg-royalDark'
                                                        };
                                                    };
                                                    const btnConfig = getButtonConfig();
                                                    return (
                                                        <button 
                                                            type="button" 
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); btnConfig.onClick && btnConfig.onClick(); }} 
                                                            className={`h-11 w-full rounded-lg text-[15px] font-bold transition-colors ${btnConfig.className}`} 
                                                            disabled={btnConfig.disabled}
                                                        >
                                                            {btnConfig.text}
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        </div>
                        <div className="flex shrink-0 justify-end border-t border-line p-4">
                            <button type="button" onClick={() => setSelectedDate(null)} className="h-12 rounded-lg bg-[#1a1a1a] px-6 text-[16px] font-bold text-white transition-colors hover:bg-black">
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}
        </section>
    );
};

export default CalendarSection;
