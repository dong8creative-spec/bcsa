import React, { useState } from 'react';
import PageTitle from './PageTitle';
import { Icons } from './Icons';

const DonationView = ({ onBack, currentUser, setCurrentUser, setMembersData, membersData, saveCurrentUserToStorage, pageTitles }) => {
    const [donationAmount, setDonationAmount] = useState(10000);
    const [customAmount, setCustomAmount] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');

    const handleDonation = () => {
        alert('후원 시스템 준비 중입니다. 문의: 관리자');
    };

    return (
        <div className="pt-32 pb-20 px-4 md:px-6 min-h-screen bg-soft animate-fade-in">
            <div className="container mx-auto max-w-4xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div>
                        <PageTitle pageKey="donation" pageTitles={pageTitles} defaultText="후원" />
                        <p className="text-gray-500 text-sm">부청사와 함께 성장하세요</p>
                    </div>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-brand font-bold hover:underline px-4 py-2 rounded-lg hover:bg-brand/5 transition-colors">
                        <Icons.ArrowLeft size={20} /> 메인으로
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-8 md:p-12">
                    <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold text-dark mb-2">후원하기</h3>
                        <p className="text-gray-600">후원 시스템 준비 중입니다.</p>
                    </div>
                    <div className="mt-6 bg-brand/5 p-6 rounded-2xl border border-brand/20">
                        <p className="text-center text-gray-700">문의: 관리자</p>
                    </div>
                    <div className="flex justify-end mt-6">
                        <button type="button" onClick={handleDonation} className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
                            후원하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DonationView;
