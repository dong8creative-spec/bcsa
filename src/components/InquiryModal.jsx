import React, { useState } from 'react';
import { Icons } from './Icons';

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

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-3xl max-w-2xl w-full flex flex-col max-h-[calc(90vh-100px)] max-md:scale-[0.8] origin-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex-1 min-h-0 overflow-y-auto modal-scroll p-8">
                    <h3 className="text-2xl font-bold text-dark mb-6">문의하기</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">이름 *</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">이메일 *</label>
                            <input
                                type="email"
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">전화번호</label>
                            <input
                                type="tel"
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                value={formData.phone}
                                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">제목 *</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none"
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">내용 *</label>
                            <textarea
                                className="w-full p-3 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none h-32 resize-none"
                                value={formData.content}
                                onChange={(e) => setFormData({...formData, content: e.target.value})}
                                required
                            />
                        </div>
                        <button type="submit" className="w-full py-4 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-all mt-6">
                            문의하기
                        </button>
                    </form>
                </div>
                <div className="shrink-0 border-t border-blue-200 p-4 flex justify-end">
                    <button type="button" onClick={onClose} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200">
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InquiryModal;
