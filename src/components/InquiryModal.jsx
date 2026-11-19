import React, { useState } from 'react';
import { Icons } from './Icons';
import ModalPortal from './ModalPortal';

const InquiryModal = ({ onClose, currentUser, onSubmit }) => {
    const [formData, setFormData] = useState({
        name: currentUser?.name || '',
        email: currentUser?.email || '',
        phone: currentUser?.phone || '',
        title: '',
        content: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.title || !formData.content) {
            alert('모든 필수 항목을 입력해주세요.');
            return;
        }
        if (onSubmit) {
            onSubmit(formData);
            setFormData({
                name: currentUser?.name || '',
                email: currentUser?.email || '',
                phone: currentUser?.phone || '',
                title: '',
                content: ''
            });
        }
        if (onClose) {
            onClose();
        }
    };

    const labelClass = 'block text-[15px] font-semibold text-ink mb-1.5';
    const inputClass = 'w-full h-[52px] px-4 bg-white border border-line2 rounded-lg text-[16px] text-ink focus:border-royal focus:outline-none transition-colors';

    return (
        <ModalPortal>
        <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/50 md:items-center md:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-labelledby="inquiry-modal-title" className="bg-white rounded-t-[18px] md:rounded-[18px] max-w-[640px] w-full flex flex-col max-h-[calc(100dvh-72px)] md:max-h-[calc(90vh-40px)]" onClick={(e) => e.stopPropagation()}>
                <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 pb-6 pt-7 md:px-8 md:pt-8">
                    <h3 id="inquiry-modal-title" className="text-[23px] font-bold text-ink mb-1.5 md:text-[24px]">문의하기</h3>
                    <p className="text-[15px] text-sub mb-6"><span className="text-red-600">*</span> 표시는 꼭 적어 주세요.</p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="inquiry-name" className={labelClass}>이름 <span className="text-red-600" aria-hidden="true">*</span></label>
                            <input
                                id="inquiry-name"
                                type="text"
                                autoComplete="name"
                                className={inputClass}
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="inquiry-email" className={labelClass}>이메일 <span className="text-red-600" aria-hidden="true">*</span></label>
                            <input
                                id="inquiry-email"
                                type="email"
                                autoComplete="email"
                                className={inputClass}
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="inquiry-phone" className={labelClass}>전화번호</label>
                            <input
                                id="inquiry-phone"
                                type="tel"
                                autoComplete="tel"
                                className={inputClass}
                                value={formData.phone}
                                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            />
                        </div>
                        <div>
                            <label htmlFor="inquiry-title" className={labelClass}>제목 <span className="text-red-600" aria-hidden="true">*</span></label>
                            <input
                                id="inquiry-title"
                                type="text"
                                className={inputClass}
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="inquiry-content" className={labelClass}>내용 <span className="text-red-600" aria-hidden="true">*</span></label>
                            <textarea
                                id="inquiry-content"
                                className="w-full p-4 bg-white border border-line2 rounded-lg text-[16px] text-ink leading-relaxed focus:border-royal focus:outline-none transition-colors h-36 resize-none"
                                value={formData.content}
                                onChange={(e) => setFormData({...formData, content: e.target.value})}
                                required
                            />
                        </div>
                        <button type="submit" className="w-full h-[52px] bg-[#1a1a1a] text-white text-[16px] font-bold rounded-lg hover:bg-black transition-colors !mt-6">
                            문의하기
                        </button>
                    </form>
                </div>
                <div className="shrink-0 border-t border-line px-4 py-3 flex justify-end">
                    <button type="button" onClick={onClose} className="h-11 px-5 bg-white border border-line2 text-ink text-[15px] font-semibold rounded-lg hover:border-ink transition-colors">
                        닫기
                    </button>
                </div>
            </div>
        </div>
        </ModalPortal>
    );
};

export default InquiryModal;
