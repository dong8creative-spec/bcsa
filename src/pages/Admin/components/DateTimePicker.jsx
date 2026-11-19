import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../../../components/Icons';

/**
 * 날짜 및 시간 선택 커스텀 컴포넌트
 * @param {Object} props
 * @param {string} props.value - 현재 값 (YYYY.MM.DD HH:mm 형식)
 * @param {Function} props.onChange - 값 변경 핸들러
 * @param {string} props.placeholder - 플레이스홀더 텍스트
 */
export const DateTimePicker = ({ value, onChange, placeholder }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const match = value.match(/(\d{4})\.(\d{2})\.(\d{2})/);
      if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, 1);
    }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    if (value) {
      const match = value.match(/(\d{4})\.(\d{2})\.(\d{2})/);
      if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    return null;
  });
  const [selectedTime, setSelectedTime] = useState(() => {
    if (value) {
      const timeMatch = value.match(/(\d{2}):(\d{2})/);
      if (timeMatch) return `${timeMatch[1]}:${timeMatch[2]}`;
    }
    return '10:00';
  });
  const calendarRef = useRef(null);

  // 외부 클릭 시 달력 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 월의 일수 계산
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  // 월의 첫 번째 요일
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  // 달력 날짜 배열 생성
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    // 빈 칸 (이전 달)
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // 현재 달 날짜
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  // 시간 옵션 생성 (30분 단위)
  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, '0');
      const minute = m.toString().padStart(2, '0');
      timeOptions.push(`${hour}:${minute}`);
    }
  }

  // 날짜 선택
  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  // 선택 완료
  const handleConfirm = () => {
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
      const day = selectedDate.getDate().toString().padStart(2, '0');
      const dateTimeStr = `${year}.${month}.${day} ${selectedTime}`;
      onChange(dateTimeStr);
      setShowCalendar(false);
    }
  };

  // 이전 달
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // 다음 달
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // 오늘 날짜 체크
  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // 선택된 날짜 체크
  const isSelected = (date) => {
    if (!date || !selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  };

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="relative" ref={calendarRef}>
      <div
        className="flex h-12 w-full cursor-pointer items-center justify-between rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
        onClick={() => setShowCalendar(!showCalendar)}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || placeholder || '날짜와 시간을 선택하세요'}
        </span>
        <Icons.Calendar size={20} className="text-gray-400" />
      </div>

      {showCalendar && (
        <div className="absolute top-full left-0 z-50 mt-2 w-80 max-w-[calc(100vw-48px)] rounded-lg border border-line2 bg-white p-4">
          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-card transition-colors" aria-label="이전 달">
              <Icons.ChevronLeft size={20} />
            </button>
            <span className="text-[17px] font-bold text-ink">
              {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
            </span>
            <button type="button" onClick={nextMonth} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-card transition-colors" aria-label="다음 달">
              <Icons.ChevronRight size={20} />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day, idx) => (
              <div key={day} className={`text-center text-[14px] font-semibold py-2 ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-royal' : 'text-gray-600'}`}>
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {generateCalendarDays().map((date, idx) => (
              <button
                key={idx}
                type="button"
                disabled={!date}
                onClick={() => date && handleDateClick(date)}
                className={`
                  h-9 w-9 rounded-lg text-[15px] font-medium transition-colors
                  ${!date ? 'invisible' : ''}
                  ${date && isSelected(date) ? 'bg-[#0c0c0e] text-white' : ''}
                  ${date && isToday(date) && !isSelected(date) ? 'border border-royal text-royal' : ''}
                  ${date && !isSelected(date) && !isToday(date) ? 'hover:bg-card' : ''}
                  ${date && idx % 7 === 0 ? 'text-red-500' : ''}
                  ${date && idx % 7 === 6 ? 'text-royal' : ''}
                `}
              >
                {date ? date.getDate() : ''}
              </button>
            ))}
          </div>

          {/* 시간 선택 */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-line">
            <Icons.Clock size={18} className="text-gray-400" />
            <span className="text-[15px] font-semibold text-ink">시간:</span>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="h-11 flex-1 rounded-lg border border-line2 bg-white px-3 text-[15px] focus:border-royal focus:outline-none"
            >
              {timeOptions.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>

          {/* 선택 완료 버튼 */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedDate}
            className={`h-12 w-full rounded-lg text-[15px] font-bold transition-colors ${selectedDate
              ? 'bg-[#0c0c0e] text-white hover:bg-black'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            선택 완료
          </button>
        </div>
      )}
    </div>
  );
};
