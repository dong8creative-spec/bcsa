import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export const useTenders = (searchKeyword = '', pageSize = 10) => {
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!searchKeyword) {
      setTenders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const tendersRef = collection(db, 'tenders');
    const now = new Date();
    
    let q = query(
      tendersRef,
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'desc'),
      limit(pageSize)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // 클라이언트 측 키워드 필터링
        const filtered = items.filter(item => 
          item.bidNtceNm && item.bidNtceNm.includes(searchKeyword)
        );
        
        setTenders(filtered);
        setLoading(false);
      },
      (err) => {
        console.error('Firestore error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [searchKeyword, pageSize]);

  return { tenders, loading, error };
};
