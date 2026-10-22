import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { groupService } from '../../services/groupService';

/**
 * 그룹장 화면: 회차 출석 QR (서버 토큰이 30초마다 바뀌어 QR도 새로 그린다)
 * 사진으로 찍어 공유해도 1~2분 뒤에는 쓸 수 없어 대리 출석을 막는다.
 */
export default function GroupQrModal({ group, session, onClose }) {
    const [dataUrl, setDataUrl] = useState('');
    const [error, setError] = useState('');
    const [secondsLeft, setSecondsLeft] = useState(30);
    const [attended, setAttended] = useState(0);
    const timer = useRef(null);
    const deadline = useRef(0);

    useEffect(() => groupService.subscribeAttendance(group.id, session.id, (rows) => setAttended(rows.length)), [group.id, session.id]);

    useEffect(() => {
        let alive = true;
        const refresh = async () => {
            try {
                const { token, refreshInMs } = await groupService.getSessionQrToken(group.id, session.id);
                const url = `${window.location.origin}/groups/${group.id}/checkin?s=${encodeURIComponent(session.id)}&t=${encodeURIComponent(token)}`;
                const img = await QRCode.toDataURL(url, { width: 520, margin: 1, errorCorrectionLevel: 'M' });
                if (!alive) return;
                setDataUrl(img);
                setError('');
                deadline.current = Date.now() + refreshInMs;
                timer.current = setTimeout(refresh, Math.max(1000, refreshInMs + 300));
            } catch (e) {
                if (!alive) return;
                setError(e.message);
                timer.current = setTimeout(refresh, 5000);
            }
        };
        refresh();
        const tick = setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 500);
        return () => { alive = false; clearTimeout(timer.current); clearInterval(tick); };
    }, [group.id, session.id]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const fee = Number(session.fee) || 0;
    return (
        <div className="fixed inset-0 z-[1200] bg-white flex flex-col items-center justify-center p-6 text-center">
            <button type="button" onClick={onClose} className="absolute top-5 right-5 px-4 py-2 rounded-full bg-soft text-sm font-semibold">닫기</button>
            <p className="text-sm text-gray-500">{group.title}</p>
            <h2 className="text-2xl md:text-3xl font-semibold text-dark mt-1 break-keep">{session.title}</h2>
            <p className="mt-2 text-sm text-gray-500">휴대폰 카메라로 찍으면 {fee > 0 ? `출석과 참가비 결제(${fee.toLocaleString()}원)가` : '출석이'} 됩니다</p>
            <div className="mt-6 w-[min(78vw,420px)] aspect-square rounded-[28px] border border-black/10 grid place-items-center overflow-hidden bg-white">
                {dataUrl ? <img src={dataUrl} alt="출석 QR 코드" className="w-full h-full" /> : <span className="text-sm text-gray-400">{error || 'QR 준비 중…'}</span>}
            </div>
            <p className="mt-4 text-sm text-gray-500">{error ? <span className="text-red-600">{error}</span> : `${secondsLeft}초 후 새 QR로 바뀝니다`}</p>
            <p className="mt-6 text-lg font-semibold text-dark">지금까지 출석 <span className="text-brand">{attended}</span>명</p>
        </div>
    );
}
