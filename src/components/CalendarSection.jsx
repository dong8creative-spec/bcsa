import React, { useState, useMemo, useEffect } from 'react';
import { Icons } from './Icons';

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
    
    // 날짜 문자열을 표준 형식(YYYY.MM.DD)으로 변환하는 함수
    const normalizeDateString = (dateStr) => {
        if (!dateStr) return null;
        
        // 시간 부분 제거 (예: "2024.01.15 14:00" -> "2024.01.15")
        let dateOnly = dateStr.trim();
        if (dateOnly.includes(' ')) {
            dateOnly = dateOnly.split(' ')[0];
        }
        if (dateOnly.includes('T')) {
            dateOnly = dateOnly.split('T')[0];
        }
        
        // 다양한 구분자 처리 (., -, /)
        dateOnly = dateOnly.replace(/-/g, '.').replace(/\//g, '.');
        
        // 날짜 파싱
        const parts = dateOnly.split('.');
        if (parts.length < 3) {
            // 다른 형식 시도 (예: "20240115")
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
        const ongoingEvents = weekEvents.filter(ev => {
            const eventDate = parseDateString(ev.date);
            if (!eventDate) return false;
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= today && (ev.status === '모집중' || ev.status === '마감임박');
        }).length;
        const endedEvents = weekEvents.filter(ev => {
            const eventDate = parseDateString(ev.date);
            if (!eventDate) return false;
            eventDate.setHours(0, 0, 0, 0);
            return eventDate < today || ev.status === '종료';
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
            let textColor = 'text-gray-700';
            if (dayOfWeek === 0) textColor = 'text-red-600';
            if (dayOfWeek === 6) textColor = 'text-blue-600';
            
            return (
                <div 
                    key={index} 
                    className={`min-h-[140px] border border-blue-200 rounded-lg p-3 transition-all hover:shadow-md ${isPastDate ? 'bg-gray-50' : 'bg-white'} ${hasEvents ? 'cursor-pointer hover:border-blue-300' : ''}`}
                    onClick={() => hasEvents && setSelectedDate(date)}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${dayOfWeek === 0 ? 'text-red-600' : dayOfWeek === 6 ? 'text-blue-600' : 'text-gray-500'}`}>
                                {['일', '월', '화', '수', '목', '금', '토'][dayOfWeek]}
                            </span>
                            <span className={`text-base font-bold ${isToday ? 'bg-brand text-white w-7 h-7 rounded-full flex items-center justify-center text-sm' : textColor} ${isPastDate ? 'opacity-60' : ''}`}>
                                {date.getDate()}
                            </span>
                        </div>
                        {hasEvents && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPastDate ? 'bg-gray-200 text-gray-600' : 'bg-brand/10 text-brand'}`}>
                                {events.length}개
                            </span>
                        )}
                    </div>
                    
                    {hasEvents && (
                        <div className="mt-2 space-y-1.5 max-h-[100px] overflow-y-auto">
                            {events.slice(0, 3).map((ev, idx) => {
                                const time = extractTime(ev);
                                const timeStr = time.hours > 0 || time.minutes > 0 
                                    ? `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`
                                    : '';
                                
                                return (
                                    <div 
                                        key={idx} 
                                        className={`text-xs px-2 py-1.5 rounded border ${isPastDate 
                                            ? 'bg-gray-100 border-blue-200 text-gray-600' 
                                            : 'bg-gray-50 border-blue-200 text-gray-800 hover:bg-gray-100'
                                        }`}
                                    >
                                        {timeStr && (
                                            <span className="text-[10px] font-semibold text-gray-500 mr-1.5">
                                                {timeStr}
                                            </span>
                                        )}
                                        <span className="font-medium truncate block">{ev.title}</span>
                                    </div>
                                );
                            })}
                            {events.length > 3 && (
                                <div className="text-[10px] text-gray-400 text-center pt-1">
                                    +{events.length - 3}개 더보기
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        });
    };
    return (
        <div className="bg-white rounded-2xl border border-blue-200 p-6 md:p-8 mt-12 animate-fade-in">
            {/* 헤더 섹션 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-2xl font-light text-gray-900 flex items-center gap-2 mb-1">
                        <Icons.Calendar className="text-gray-600" size={24} /> 프로그램 일정표
                    </h3>
                    <p className="text-sm text-gray-400">날짜를 클릭하면 상세 내용을 확인할 수 있습니다.</p>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-blue-200">
                    <button 
                        onClick={prevWeek} 
                        className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600 border border-transparent hover:border-blue-200"
                    >
                        <Icons.ArrowLeft size={16} />
                    </button>
                    <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center px-2">
                        {weekRangeText}
                    </span>
                    <button 
                        onClick={nextWeek} 
                        className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600 border border-transparent hover:border-blue-200"
                    >
                        <Icons.ArrowRight size={16} />
                    </button>
                </div>
            </div>
            
            {/* 통계 섹션 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-xs text-gray-500 font-medium mb-1">이번 주 일정</div>
                    <div className="text-2xl font-light text-gray-900">{weekStats.totalEvents}</div>
                    <div className="text-xs text-gray-400 mt-1">전체 프로그램</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-xs text-blue-600 font-medium mb-1">진행 중</div>
                    <div className="text-2xl font-light text-blue-900">{weekStats.ongoingEvents}</div>
                    <div className="text-xs text-blue-500 mt-1">모집 중 / 마감임박</div>
                </div>
                <div className="bg-gray-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-xs text-gray-500 font-medium mb-1">종료</div>
                    <div className="text-2xl font-light text-gray-700">{weekStats.endedEvents}</div>
                    <div className="text-xs text-gray-400 mt-1">지난 일정</div>
                </div>
            </div>
            
            {/* 주간 캘린더 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {renderCalendarDays()}
            </div>
            {selectedDate && getEventsForDate(selectedDate).length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ opacity: 1 }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedDate(null); }}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"></div>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(90vh-100px)] overflow-hidden z-10 flex flex-col border border-blue-200" style={{ opacity: 1, transform: 'scale(1)' }} onClick={(e) => e.stopPropagation()}>
                        <div className="flex-1 overflow-y-auto modal-scroll p-6">
                            <h4 className="text-2xl font-bold text-dark mb-2">{formatDate(selectedDate)} 프로그램</h4>
                            <p className="text-sm text-gray-500 mb-6">시간대별로 정렬된 일정입니다</p>
                        <div className="space-y-4">
                            {getEventsForDate(selectedDate).map((ev, idx) => {
                                const time = extractTime(ev);
                                const timeStr = time.hours > 0 || time.minutes > 0 
                                    ? `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`
                                    : '';
                                
                                return (
                                    <div key={idx} className="border border-blue-200 rounded-lg p-4 hover:border-blue-300 transition-all bg-white">
                                        <div className="flex items-start gap-4">
                                            {timeStr && (
                                                <div className="flex-shrink-0 w-16 text-center">
                                                    <div className="text-xs text-gray-500 font-medium mb-1">시간</div>
                                                    <div className="text-base font-semibold text-gray-900">{timeStr}</div>
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                    <h5 className="font-semibold text-lg text-gray-900 leading-tight">{ev.title}</h5>
                                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                                                        ev.status === '모집중' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 
                                                        ev.status === '마감임박' ? 'bg-red-50 text-red-700 border border-red-200' : 
                                                        'bg-gray-100 text-gray-600 border border-blue-200'
                                                    }`}>
                                                        {ev.status}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col gap-2 mb-3">
                                                    <span className="text-sm text-gray-600 font-medium flex items-center gap-2">
                                                        <Icons.Clock size={14} className="text-gray-400"/> {ev.date}
                                                    </span>
                                                    {ev.location && (
                                                        <span className="text-sm text-gray-600 font-medium flex items-center gap-2">
                                                            <Icons.MapPin size={14} className="text-gray-400"/> {ev.location}
                                                        </span>
                                                    )}
                                                    <span className="text-sm text-gray-600 font-medium flex items-center gap-2">
                                                        <Icons.Users size={14} className="text-gray-400"/> 신청현황: <span className="text-gray-900 font-semibold">{ev.currentParticipants || 0}</span> / {ev.maxParticipants || 100}명
                                                    </span>
                                                </div>
                                                {ev.desc && (
                                                    <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-blue-100 mb-3">
                                                        {ev.desc}
                                                    </p>
                                                )}
                                                {!currentUser ? (
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); alert("로그인이 필요한 서비스입니다. 먼저 로그인해주세요."); }} 
                                                        className="w-full py-2.5 text-sm font-medium rounded-lg transition-colors bg-gray-200 text-gray-500 cursor-not-allowed border border-blue-300" 
                                                        disabled
                                                    >
                                                        로그인 후 신청 가능
                                                    </button>
                                                ) : (() => {
                                                    const getButtonConfig = () => {
                                                        if (ev.status === '종료') {
                                                            return { text: '종료된 일정', disabled: true, onClick: null, className: 'bg-gray-200 text-gray-500 cursor-not-allowed border border-blue-300' };
                                                        }
                                                        if (ev.status === '후기작성가능') {
                                                            const hasApplied = applications?.some(app => 
                                                                String(app.seminarId) === String(ev.id) && String(app.userId) === String(currentUser?.id)
                                                            );
                                                            if (hasApplied) {
                                                                return { 
                                                                    text: '후기쓰기', 
                                                                    disabled: false, 
                                                                    onClick: () => { onWriteReview && onWriteReview(ev); setSelectedDate(null); },
                                                                    className: 'bg-green-600 text-white hover:bg-green-700 border border-green-700'
                                                                };
                                                            }
                                                            return { text: '참여자만', disabled: true, onClick: null, className: 'bg-gray-200 text-gray-500 cursor-not-allowed border border-blue-300' };
                                                        }
                                                        return { 
                                                            text: '신청하기', 
                                                            disabled: false, 
                                                            onClick: () => { onSelectSeminar(ev); setSelectedDate(null); },
                                                            className: 'bg-brand text-white hover:bg-blue-700 border border-blue-700'
                                                        };
                                                    };
                                                    const btnConfig = getButtonConfig();
                                                    return (
                                                        <button 
                                                            type="button" 
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); btnConfig.onClick && btnConfig.onClick(); }} 
                                                            className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${btnConfig.className}`} 
                                                            disabled={btnConfig.disabled}
                                                        >
                                                            {btnConfig.text}
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        </div>
                        <div className="shrink-0 border-t border-blue-200 p-4 flex justify-end">
                            <button type="button" onClick={() => setSelectedDate(null)} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarSection;
