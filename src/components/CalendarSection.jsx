import React, { useState } from 'react';
import { Icons } from './Icons';

const CalendarSection = ({ seminars, onSelectSeminar, currentUser }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const getEventsForDate = (day) => seminars.filter(s => {
        const parts = s.date.replace(/-/g, '.').split('.'); 
        if (parts.length < 3) return false;
        return parseInt(parts[0]) === year && parseInt(parts[1]) - 1 === month && parseInt(parts[2]) === day;
    });
    const renderCalendarDays = () => {
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) days.push(<div key={`empty-${i}`} className="h-28 bg-white border-r border-b border-[#0045a5]"></div>);
        for (let d = 1; d <= daysInMonth; d++) {
            const events = getEventsForDate(d);
            const dayOfWeek = new Date(year, month, d).getDay();
            const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
            const hasEvents = events.length > 0;
            let textColor = 'text-gray-700'; if (dayOfWeek === 0) textColor = 'text-red-600'; if (dayOfWeek === 6) textColor = 'text-blue-600';
            days.push(
                <div key={d} onClick={() => hasEvents && setSelectedDate(d)} className={`h-28 border-r border-b border-[#0045a5] p-0 relative transition-colors bg-white ${hasEvents ? 'cursor-pointer hover:bg-brand/5' : ''}`}>
                     {hasEvents ? (<div className="absolute inset-0 bg-brand/5 p-2 flex flex-col justify-between h-full w-full"><div className="flex justify-between items-start"><span className={`text-sm font-bold ${isToday ? 'bg-brand text-white w-6 h-6 rounded-full flex items-center justify-center' : textColor}`}>{d}</span><span className="text-[10px] font-bold text-brand bg-white px-1.5 py-0.5 rounded-full border border-brand/20">+{events.length}</span></div><div className="flex flex-col gap-1 mt-1 flex-1 justify-end">{events.slice(0, 2).map((ev, idx) => (<div key={idx} className="text-[10px] px-1.5 py-1 rounded truncate font-bold bg-brand text-white shadow-sm w-full text-center">{ev.title}</div>))}</div></div>) : (<div className="p-2 h-full flex flex-col"><span className={`text-sm font-bold ${isToday ? 'bg-brand text-white w-6 h-6 rounded-full flex items-center justify-center' : textColor}`}>{d}</span></div>)}
                </div>
            );
        }
        const totalCells = firstDayOfMonth + daysInMonth;
        const weeksNeeded = Math.ceil(totalCells / 7);
        for (let i = totalCells; i < weeksNeeded * 7; i++) {
            days.push(<div key={`empty-end-${i}`} className="h-28 bg-white border-r border-b border-[#0045a5]"></div>);
        }
        return days;
    };
    return (
        <div className="bg-white rounded-3xl shadow-card p-6 md:p-8 mt-12 animate-fade-in relative border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div><h3 className="text-2xl font-bold text-dark flex items-center gap-2"><Icons.Calendar className="text-brand" /> 월간 일정표</h3><p className="text-gray-500 text-sm mt-1">날짜를 클릭하면 상세 내용을 확인할 수 있습니다.</p></div>
                <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-1"><button onClick={prevMonth} className="p-2 hover:bg-white hover:shadow rounded-lg transition-all text-gray-600"><Icons.ArrowLeft size={18} /></button><span className="text-lg font-bold text-dark min-w-[100px] text-center">{year}. {String(month + 1).padStart(2, '0')}</span><button onClick={nextMonth} className="p-2 hover:bg-white hover:shadow rounded-lg transition-all text-gray-600"><Icons.ArrowRight size={18} /></button></div>
            </div>
            <div className="grid grid-cols-7 mb-0 text-center border-b border-[#0045a5] border-l border-[#0045a5] border-r border-[#0045a5] bg-brand/5 rounded-t-lg calendar-top-border">{['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (<div key={day} className={`text-sm font-bold py-3 ${idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : 'text-gray-700'}`}>{day}</div>))}</div>
            <div className="grid grid-cols-7 border-l border-t border-[#0045a5] calendar-left-border calendar-top-border bg-white">{renderCalendarDays()}</div>
            {selectedDate && getEventsForDate(selectedDate).length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ opacity: 1 }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedDate(null); }}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"></div>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden z-10 flex flex-col relative" style={{ opacity: 1, transform: 'scale(1)' }} onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h4 className="font-bold text-xl text-dark">{month + 1}월 {selectedDate}일 일정</h4>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedDate(null); }} className="p-2 bg-white rounded-full hover:bg-gray-200 transition-colors shadow-sm">
                                <Icons.X size={20} />
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto modal-scroll space-y-6">
                            {getEventsForDate(selectedDate).map((ev, idx) => (
                                <div key={idx} className="flex flex-col gap-4">
                                    <div className="w-full h-48 rounded-xl overflow-hidden shadow-sm relative">
                                        <img src={ev.img || "https://placehold.co/600x400"} alt={ev.title} className="w-full h-full object-cover" />
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
                                    ) : (
                                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelectSeminar(ev); setSelectedDate(null); }} className={`w-full py-3 font-bold rounded-xl transition-colors shadow-lg mt-2 ${ev.status === '종료' || ev.status === '마감' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-brand text-white hover:bg-blue-700 shadow-brand/20'}`} disabled={ev.status === '종료' || ev.status === '마감'}>
                                            {ev.status === '종료' ? '종료된 일정' : ev.status === '마감' ? '신청 마감' : '신청하기'}
                                        </button>
                                    )}
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
