import { useEffect } from 'react';

const BASE_URL = 'https://bcsa.co.kr';

const SEO_MAP = {
    home: {
        title: '부청사 | 부산 청년 사업가를 위한 비즈니스 커뮤니티',
        description: '부산·경남 청년 사업가, 자영업자, 소상공인이 모이는 실전형 비즈니스 커뮤니티. 마케팅 세미나, 네트워킹 모임, 창업 지원사업 정보를 한곳에서 만나보세요.',
        path: '/',
    },
    about: {
        title: '소개 | 부청사 - 부산 청년 사업가 커뮤니티',
        description: '2017년부터 부산·경남 청년 사업가들의 성장과 연결을 돕는 비즈니스 플랫폼 부청사를 소개합니다. 부산사업자모임, 부산창업 커뮤니티의 중심.',
        path: '/about',
    },
    allSeminars: {
        title: '프로그램 | 부산 사업자 세미나·네트워킹 모임 - 부청사',
        description: '부산·경남 청년 사업가, 자영업자를 위한 마케팅 세미나, 네트워킹 모임, 창업 교육 프로그램 목록입니다. 부산비즈니스모임·부산청년플랫폼 대표 프로그램.',
        path: '/programs',
    },
    allMembers: {
        title: '부청사 회원 | 부산 청년 사업가 멤버십 - 부청사',
        description: '부청사에서 활동 중인 부산·경남 청년 사업가, 자영업자, 소상공인 회원 목록입니다.',
        path: '/members',
    },
    community: {
        title: '커뮤니티 | 부산 청년 사업가 게시판 - 부청사',
        description: '부산 청년 사업가들이 정보와 경험을 나누는 커뮤니티 공간입니다.',
        path: '/community',
    },
    notice: {
        title: '공지사항 | 부청사',
        description: '부청사의 새로운 소식과 공지사항을 확인하세요.',
        path: '/notice',
    },
    restaurants: {
        title: '부산맛집 | 부청사 회원 추천 부산 맛집 - 부청사',
        description: '부청사 회원들이 추천하는 부산 지역 맛집 정보를 확인하세요.',
        path: '/restaurants',
    },
    restaurantDetail: {
        title: '맛집 상세 | 부청사',
        description: '부청사 회원이 추천하는 부산 맛집 상세 정보입니다.',
        path: '/restaurants',
    },
    donation: {
        title: '후원 | 부청사를 함께 만들어가세요',
        description: '부산 청년 사업가들의 성장을 응원하는 부청사 후원 프로그램입니다.',
        path: '/donation',
    },
    myPage: {
        title: '마이페이지 | 부청사',
        description: '내 신청 프로그램과 게시글을 확인하세요.',
        path: '/my',
    },
};

const setMeta = (attr, name, content) => {
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
};

const setCanonical = (href) => {
    let el = document.querySelector('link[rel="canonical"]');
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
};

const setJsonLd = (id, data) => {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('script');
        el.setAttribute('type', 'application/ld+json');
        el.setAttribute('id', id);
        document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
};

const removeJsonLd = (id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
};

export const useSEO = ({ view, ogImage, overrideTitle, overrideDescription, overridePath, jsonLd } = {}) => {
    useEffect(() => {
        const seo = SEO_MAP[view] || SEO_MAP.home;
        const title = overrideTitle || seo.title;
        const description = overrideDescription || seo.description;
        const canonicalPath = overridePath || seo.path;
        const canonicalUrl = BASE_URL + canonicalPath;

        document.title = title;

        setMeta('name', 'description', description);

        setCanonical(canonicalUrl);

        // Open Graph
        setMeta('property', 'og:title', title);
        setMeta('property', 'og:description', description);
        setMeta('property', 'og:url', canonicalUrl);
        setMeta('property', 'og:type', 'website');
        setMeta('property', 'og:site_name', '부청사 | 부산청년사업가들');
        setMeta('property', 'og:locale', 'ko_KR');
        if (ogImage) {
            setMeta('property', 'og:image', ogImage);
            setMeta('property', 'og:image:width', '1200');
            setMeta('property', 'og:image:height', '630');
            setMeta('property', 'og:image:alt', title);
        }

        // Twitter Card
        setMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary');
        setMeta('name', 'twitter:title', title);
        setMeta('name', 'twitter:description', description);
        if (ogImage) setMeta('name', 'twitter:image', ogImage);

        // JSON-LD
        if (jsonLd) {
            setJsonLd('ld-json-main', jsonLd);
        } else {
            removeJsonLd('ld-json-main');
        }

    }, [view, ogImage, overrideTitle, overrideDescription, overridePath, jsonLd]);
};
