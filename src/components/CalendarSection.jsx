import React, { useState } from 'react';
import { Icons } from './Icons';

const CalendarSection = ({ seminars, onSelectSeminar, currentUser, onWriteReview, applications }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    
    // 접속일 기준 주의 시작일(일요일) 계산
    const getWeekStart = (date) => {
        const d = new Date(date);
        const day = d.getDay(); // 0(일) ~ 6(토)
        const diff = d.getDate() - day; // 일요일로 이동
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - day);
        return weekStart;
    };
    
    // 주의 7일 배열 생성
    const weekStart = getWeekStart(currentDate);
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        weekDays.push(day);
    }
    
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
    
    // 주 범위 표시 문자열
    const weekRangeText = `${formatDate(weekDays[0])} ~ ${formatDate(weekDays[6])}`;
    
    // 특정 날짜의 이벤트 가져오기
    const getEventsForDate = (date) => {
        const dateStr = formatDate(date);
        return seminars.filter(s => {
            const parts = s.date.replace(/-/g, '.').split('.'); 
            if (parts.length < 3) return false;
            const eventDateStr = `${parts[0]}.${parts[1].padStart(2, '0')}.${parts[2].padStart(2, '0')}`;
            return eventDateStr === dateStr;
        });
    };
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
                    onClick={() => hasEvents && setSelectedDate(date)} 
                    className={`h-[120px] border-r border-b border-[#0045a5] p-2 relative transition-colors ${isPastDate ? 'bg-gray-50' : 'bg-white'} ${hasEvents ? 'cursor-pointer hover:bg-brand/5' : ''}`}
                >
                    {hasEvents ? (
                        <div className={`absolute inset-0 p-2 flex flex-col justify-between h-full w-full ${isPastDate ? 'bg-gray-100' : 'bg-brand/5'}`}>
                            <div className="flex justify-between items-start">
                                <span className={`text-sm font-bold ${isToday ? 'bg-brand text-white w-6 h-6 rounded-full flex items-center justify-center' : textColor} ${isPastDate ? 'opacity-70' : ''}`}>
                                    {date.getDate()}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${isPastDate ? 'text-gray-500 bg-white border-gray-200' : 'text-brand bg-white border-brand/20'}`}>
                                    +{events.length}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1 mt-1 flex-1 justify-end">
                                {events.slice(0, 2).map((ev, idx) => (
                                    <div key={idx} className={`text-[10px] px-1.5 py-1 rounded truncate font-bold shadow-sm w-full text-center ${isPastDate ? 'bg-gray-500 text-white' : 'bg-brand text-white'}`}>
                                        {ev.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="p-2 h-full flex flex-col">
                            <span className={`text-sm font-bold ${isToday ? 'bg-brand text-white w-6 h-6 rounded-full flex items-center justify-center' : textColor} ${isPastDate ? 'opacity-70' : ''}`}>
                                {date.getDate()}
                            </span>
                        </div>
                    )}
                </div>
            );
        });
    };
    return (
        <div className="bg-white rounded-3xl shadow-card p-6 md:p-8 mt-12 animate-fade-in relative border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h3 className="text-2xl font-bold text-dark flex items-center gap-2">
                        <Icons.Calendar className="text-brand" /> 주간 일정표
                    </h3>
                    <p className="text-gray-500 text-sm mt-1">날짜를 클릭하면 상세 내용을 확인할 수 있습니다.</p>
                </div>
                <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-1">
                    <button onClick={prevWeek} className="p-2 hover:bg-white hover:shadow rounded-lg transition-all text-gray-600">
                        <Icons.ArrowLeft size={18} />
                    </button>
                    <span className="text-sm font-bold text-dark min-w-[200px] text-center">{weekRangeText}</span>
                    <button onClick={nextWeek} className="p-2 hover:bg-white hover:shadow rounded-lg transition-all text-gray-600">
                        <Icons.ArrowRight size={18} />
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 mb-0 text-center border-b border-[#0045a5] border-l border-[#0045a5] border-r border-[#0045a5] bg-brand/5 rounded-t-lg calendar-top-border">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                    <div key={day} className={`text-sm font-bold py-3 ${idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : 'text-gray-700'}`}>
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 border-l border-t border-[#0045a5] calendar-left-border calendar-top-border bg-white">
                {renderCalendarDays()}
            </div>
            {selectedDate && getEventsForDate(selectedDate).length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ opacity: 1 }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedDate(null); }}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"></div>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden z-10 flex flex-col relative" style={{ opacity: 1, transform: 'scale(1)' }} onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h4 className="font-bold text-xl text-dark">{formatDate(selectedDate)} 일정</h4>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedDate(null); }} className="p-2 bg-white rounded-full hover:bg-gray-200 transition-colors shadow-sm">
                                <Icons.X size={20} />
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto modal-scroll space-y-6">
                            {getEventsForDate(selectedDate).map((ev, idx) => (
                                <div key={idx} className="flex flex-col gap-4">
                                    <div className="w-full h-48 rounded-xl overflow-hidden shadow-sm relative">
                                        {ev.img && <img src={ev.img} alt={ev.title} className="w-full h-full object-cover" />}
                                        <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${ev.status === '모집중' ? 'bg-brand text-white' : ev.status === '마감임박' ? 'bg-red-500 text-white' : 'bg-gray-500 text-white'}`}>{ev.status}</div>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-xl text-dark mb-2 leading-tight">{ev.title}</h5>
                                        <div className="flex flex-col gap-2 mb-4">
                                            <span className="text-sm text-gray-500 font-medium flex items-center gap-2"><Icons.Clock size={16} className="text-brand"/> {ev.date}</span>
                                            <span className="text-sm text-gray-500 font-medium flex items-center gap-2"><Icons.MapPin size={16} className="text-brand"/> {ev.location}</span>
                                            <span className="text-sm text-gray-500 font-medium flex items-center gap-2"><Icons.Users size={16} className="text-brand"/> 신청현황: <span className="text-brand font-bold">{ev.currentParticipants || 0}</span> / {ev.maxParticipants || 100} 명</span>
                                        </div>
                                        <p className="text-gray-600 text-sm leading-relaxed bg-soft p-4 rounded-xl border border-brand/5">{ev.desc}</p>
                                    </div>
                                    {!currentUser ? (
                                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); alert("로그인이 필요한 서비스입니다. 먼저 로그인해주세요."); }} className="w-full py-3 font-bold rounded-xl transition-colors shadow-lg mt-2 bg-gray-300 text-gray-500 cursor-not-allowed" disabled>
                                            로그인 후 신청 가능
                                        </button>
                                    ) : (() => {
                                        // 버튼 설정 계산
                                        const getButtonConfig = () => {
                                            if (ev.status === '종료') {
                                                return { text: '종료된 일정', disabled: true, onClick: null, className: 'bg-gray-300 text-gray-500 cursor-not-allowed' };
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
                                                        className: 'bg-green-600 text-white hover:bg-green-700'
                                                    };
                                                }
                                                return { text: '참여자만', disabled: true, onClick: null, className: 'bg-gray-300 text-gray-500 cursor-not-allowed' };
                                            }
                                            return { 
                                                text: '신청하기', 
                                                disabled: false, 
                                                onClick: () => { onSelectSeminar(ev); setSelectedDate(null); },
                                                className: 'bg-brand text-white hover:bg-blue-700 shadow-brand/20'
                                            };
                                        };
                                        const btnConfig = getButtonConfig();
                                        return (
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); btnConfig.onClick && btnConfig.onClick(); }} 
                                                className={`w-full py-3 font-bold rounded-xl transition-colors shadow-lg mt-2 ${btnConfig.className}`} 
                                                disabled={btnConfig.disabled}
                                            >
                                                {btnConfig.text}
                                            </button>
                                        );
                                    })()}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarSection;
