import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where, 
  limit,
  onSnapshot,
  writeBatch,
  setDoc,
  serverTimestamp,
  Timestamp,
  increment,
  deleteField
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '../firebase';
import { deleteHostedImagesForPayload } from '../utils/imageUtils';

// Firebase Data Service Layer
export const firebaseService = {
  // ==========================================
  // Users Collection
  // ==========================================
  async getUsers() {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  },

  async getUser(userId) {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id };
      }
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  },

  /** 이메일로 기존 회원 1명 조회 (중복 검사용, 회원 수와 무관하게 1건만 읽음) */
  async getUserByEmail(email) {
    if (!email || typeof email !== 'string' || !email.trim()) return null;
    try {
      const q = query(
        collection(db, 'users'),
        where('email', '==', email.trim()),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const d = snapshot.docs[0];
      return { ...d.data(), id: d.id };
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  },

  /** 연락처(정규화된 숫자 문자열)로 기존 회원 1명 조회 (중복 검사용) */
  async getUserByPhone(normalizedPhone) {
    if (!normalizedPhone || typeof normalizedPhone !== 'string') return null;
    const digits = normalizedPhone.replace(/\D/g, '');
    if (!digits.length) return null;
    try {
      const q = query(
        collection(db, 'users'),
        where('phone', '==', digits),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        const q2 = query(
          collection(db, 'users'),
          where('phoneNumber', '==', digits),
          limit(1)
        );
        const snap2 = await getDocs(q2);
        if (snap2.empty) return null;
        const d = snap2.docs[0];
        return { ...d.data(), id: d.id };
      }
      const d = snapshot.docs[0];
      return { ...d.data(), id: d.id };
    } catch (error) {
      console.error('Error getting user by phone:', error);
      throw error;
    }
  },

  async createUser(userData) {
    try {
      const data = {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (userData.uid) {
        await setDoc(doc(db, 'users', userData.uid), data);
        return userData.uid;
      }
      const docRef = await addDoc(collection(db, 'users'), data);
      return docRef.id;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  async updateUser(userId, userData) {
    try {
      const id = (userId ?? '').toString().trim();
      if (!id) {
        throw new Error('updateUser: userId가 비어 있습니다.');
      }
      const docRef = doc(db, 'users', id);
      const payload = { updatedAt: serverTimestamp() };
      for (const [key, value] of Object.entries(userData || {})) {
        if (value !== undefined) payload[key] = value;
      }
      await updateDoc(docRef, payload);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  async deleteUser(userId) {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  /** 관리자 강제 탈퇴 시 Firebase Auth 사용자 삭제 (Cloud Function 호출, 재가입 가능하도록) */
  async deleteAuthUser(uid) {
    const uidStr = typeof uid === 'string' ? uid.trim() : (uid ? String(uid).trim() : '');
    if (!uidStr) {
      throw new Error('삭제할 사용자 uid가 없습니다.');
    }
    try {
      const functions = getFunctions(app, 'asia-northeast3');
      const callable = httpsCallable(functions, 'deleteAuthUser');
      await callable({ uid: uidStr });
    } catch (error) {
      const msg = error?.message || error?.details || 'Auth 사용자 삭제 실패';
      console.error('Error deleting Auth user:', error);
      throw new Error(typeof msg === 'string' ? msg : 'Auth 사용자 삭제에 실패했습니다.');
    }
  },

  /** 관리자 강제 탈퇴 시 1년간 재가입 차단 목록에 등록 (관리자만, Cloud Function 호출) */
  async addBlockedRegistration(uid, email, phone) {
    const uidStr = typeof uid === 'string' ? uid.trim() : (uid ? String(uid).trim() : '');
    if (!uidStr) return;
    try {
      const functions = getFunctions(app, 'asia-northeast3');
      const callable = httpsCallable(functions, 'addBlockedRegistration');
      await callable({
        uid: uidStr,
        email: (email != null && email !== undefined) ? String(email).trim() : '',
        phone: (phone != null && phone !== undefined) ? String(phone).replace(/\D/g, '').slice(0, 11) : ''
      });
    } catch (error) {
      console.error('Error adding blocked registration:', error);
      throw error;
    }
  },

  /** 회원가입 전 1년 차단 여부 조회 (uid/email/phone 기준, 비인증 호출 가능) */
  async checkBlockedRegistration({ uid, email, phone }) {
    try {
      const functions = getFunctions(app, 'asia-northeast3');
      const callable = httpsCallable(functions, 'checkBlockedRegistration');
      const res = await callable({
        uid: uid ? String(uid).trim() : '',
        email: email != null ? String(email).trim().toLowerCase() : '',
        phone: phone != null ? String(phone).replace(/\D/g, '').slice(0, 11) : ''
      });
      const data = res?.data;
      return data && typeof data.blocked === 'boolean' ? data : { blocked: false };
    } catch (error) {
      console.error('Error checking blocked registration:', error);
      return { blocked: false };
    }
  },

  subscribeUsers(callback) {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      callback(users);
    });
  },

  // ==========================================
  // User Notifications (users/{userId}/notifications)
  // ==========================================
  async addUserNotification(userId, { type, message, correctedFields }) {
    try {
      const notificationsRef = collection(db, 'users', userId, 'notifications');
      const docRef = await addDoc(notificationsRef, {
        type: type || 'profile_corrected',
        message: message || '회원정보가 정정되었습니다.',
        correctedFields: correctedFields || [],
        createdAt: serverTimestamp(),
        read: false
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding user notification:', error);
      throw error;
    }
  },

  async getUserNotifications(userId) {
    try {
      const notificationsRef = collection(db, 'users', userId, 'notifications');
      const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  },

  subscribeUserNotifications(userId, callback) {
    if (!userId) return () => {};
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(list);
    });
  },

  async markNotificationRead(userId, notificationId) {
    try {
      const docRef = doc(db, 'users', userId, 'notifications', notificationId);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      console.error('Error marking notification read:', error);
      throw error;
    }
  },

  // 햇반 계정 식별 함수
  isHaetbanAccount(user) {
    return user.name === '햇반' || 
           user.email === 'haetban@bcsa-b190f.firebaseapp.com' || 
           (user.isAdmin === true && user.name === '햇반');
  },

  // ==========================================
  // Seminars Collection
  // ==========================================

  /**
   * 세미나 스냅샷 → 클라이언트 객체.
   * 본문에 id/seminarId 등이 있어도 id·seminarDocumentId는 항상 Firestore 문서 ID (신청 집계·매칭 기준).
   */
  _mapSeminarDoc(docSnap) {
    const data = docSnap.data();
    const docId = docSnap.id;
    return {
      ...data,
      id: docId,
      seminarDocumentId: docId
    };
  },

  /** seminars 문서에 저장하면 신청(seminarId)과 어긋날 수 있는 필드 — 수정/생성 시 제거 */
  _omitSeminarIdentityFields(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = { ...obj };
    const keys = ['id', 'seminarId', 'programId', 'seminar_id', 'program_id', 'seminarDocumentId'];
    for (const k of keys) delete out[k];
    return out;
  },

  async getSeminars() {
    try {
      const snapshot = await getDocs(collection(db, 'seminars'));
      const seminars = snapshot.docs.map((d) => this._mapSeminarDoc(d));
      console.log('📖 Firebase getSeminars 성공:', {
        count: seminars.length,
        sample: seminars.length > 0 ? {
          id: seminars[0].id,
          title: seminars[0].title,
          images: seminars[0].images,
          imagesType: Array.isArray(seminars[0].images) ? 'array' : typeof seminars[0].images,
          img: seminars[0].img
        } : null
      });
      return seminars;
    } catch (error) {
      console.error('❌ Error getting seminars:', error);
      throw error;
    }
  },

  async getSeminar(seminarId) {
    try {
      const docRef = doc(db, 'seminars', seminarId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return this._mapSeminarDoc(docSnap);
      }
      return null;
    } catch (error) {
      console.error('Error getting seminar:', error);
      throw error;
    }
  },

  async createSeminar(seminarData) {
    try {
      console.log('🔥 Firebase createSeminar 호출 (인덱스):', {
        seminarData: {
          ...seminarData,
          images: seminarData.images,
          imagesLength: Array.isArray(seminarData.images) ? seminarData.images.length : 'not array',
          img: seminarData.img
        }
      });
      
      // Firestore에 저장할 데이터 준비 (id·seminarId 등 본문 식별자는 저장하지 않음 → 수정 후에도 신청 집계와 문서 ID 일치)
      const { id: _omitSeminarId, ...seminarFields } = seminarData || {};
      const dataToSave = {
        ...this._omitSeminarIdentityFields(seminarFields),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // images: 배열만 검사. 요소는 문자열 또는 { firebase, imgbb } 이중 저장 형식 모두 허용
      if (dataToSave.images && !Array.isArray(dataToSave.images)) {
        console.warn('⚠️ images가 배열이 아닙니다. 배열로 변환합니다:', dataToSave.images);
        dataToSave.images = Array.isArray(dataToSave.images) ? dataToSave.images : [dataToSave.images].filter(Boolean);
      }
      
      console.log('💾 Firestore에 저장할 최종 데이터 (인덱스):', {
        ...dataToSave,
        images: dataToSave.images,
        imagesType: Array.isArray(dataToSave.images) ? 'array' : typeof dataToSave.images
      });
      
      const docRef = await addDoc(collection(db, 'seminars'), dataToSave);
      
      console.log('✅ Firebase createSeminar 성공 (인덱스):', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating seminar (인덱스):', error);
      console.error('에러 상세:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        seminarData
      });
      throw error;
    }
  },

  async updateSeminar(seminarId, seminarData) {
    try {
      console.log('🔥 Firebase updateSeminar 호출 (인덱스):', {
        seminarId,
        seminarData: {
          ...seminarData,
          images: seminarData.images,
          imagesLength: Array.isArray(seminarData.images) ? seminarData.images.length : 'not array',
          img: seminarData.img
        }
      });
      
      const { id: _omitSeminarId, ...seminarFields } = seminarData || {};
      const dataToSave = {
        ...this._omitSeminarIdentityFields(seminarFields),
        updatedAt: serverTimestamp()
      };
      
      // images: 배열만 검사. 요소는 문자열 또는 { firebase, imgbb } 이중 저장 형식 모두 허용
      if (dataToSave.images && !Array.isArray(dataToSave.images)) {
        console.warn('⚠️ images가 배열이 아닙니다. 배열로 변환합니다:', dataToSave.images);
        dataToSave.images = Array.isArray(dataToSave.images) ? dataToSave.images : [dataToSave.images].filter(Boolean);
      }

      // 본문에 남아 있던 id/seminarId 등 제거 — 신청(seminarId)은 항상 문서 ID 기준이므로 수정 후 집계 어긋남 방지
      const stripDocIdentity = ['seminarId', 'programId', 'seminar_id', 'program_id', 'id'];
      for (const k of stripDocIdentity) {
        dataToSave[k] = deleteField();
      }
      
      console.log('💾 Firestore에 저장할 최종 데이터 (인덱스):', {
        ...dataToSave,
        images: dataToSave.images,
        imagesType: Array.isArray(dataToSave.images) ? 'array' : typeof dataToSave.images
      });
      
      const docRef = doc(db, 'seminars', seminarId);
      await updateDoc(docRef, dataToSave);
      
      console.log('✅ Firebase updateSeminar 성공 (인덱스):', seminarId);
    } catch (error) {
      console.error('❌ Error updating seminar (인덱스):', error);
      console.error('에러 상세:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        seminarId,
        seminarData
      });
      throw error;
    }
  },

  /** 신청 1건 반영 시 currentParticipants를 원자적으로 증가 (클라이언트에 낡은 currentParticipants가 있어도 누락 방지) */
  async incrementSeminarParticipants(seminarId, delta = 1) {
    if (seminarId == null || seminarId === '') return;
    const n = Number(delta);
    if (!Number.isFinite(n) || n === 0) return;
    try {
      const docRef = doc(db, 'seminars', String(seminarId));
      await updateDoc(docRef, {
        currentParticipants: increment(n),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('incrementSeminarParticipants failed:', error);
      throw error;
    }
  },

  async deleteSeminar(seminarId) {
    try {
      await deleteDoc(doc(db, 'seminars', seminarId));
    } catch (error) {
      console.error('Error deleting seminar:', error);
      throw error;
    }
  },

  subscribeSeminars(callback) {
    return onSnapshot(collection(db, 'seminars'), (snapshot) => {
      const seminars = snapshot.docs.map((d) => this._mapSeminarDoc(d));
      callback(seminars);
    });
  },

  // ==========================================
  // Posts Collection
  // ==========================================
  async getPosts() {
    try {
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting posts:', error);
      throw error;
    }
  },

  async getPost(postId) {
    try {
      const docRef = doc(db, 'posts', postId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting post:', error);
      throw error;
    }
  },

  async createPost(postData) {
    try {
      const docRef = await addDoc(collection(db, 'posts'), {
        ...postData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  },

  async updatePost(postId, postData) {
    try {
      // undefined 및 null 필드 제거 및 데이터 정제
      const cleanedData = Object.keys(postData).reduce((acc, key) => {
        const value = postData[key];
        // undefined, null이 아니고, 빈 배열이 아닌 경우만 포함
        if (value !== undefined && value !== null) {
          // 빈 배열도 유효한 값으로 처리 (이미지 삭제 시 빈 배열이 될 수 있음)
          acc[key] = value;
        }
        return acc;
      }, {});
      
      const docRef = doc(db, 'posts', postId);
      await updateDoc(docRef, {
        ...cleanedData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  },

  async deletePost(postId) {
    try {
      const id = String(postId || '').trim();
      if (!id) return;
      const ref = doc(db, 'posts', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() || {};
        await deleteHostedImagesForPayload({ id, ...data });
      }
      await deleteDoc(ref);
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  },

  /**
   * 회원 탈퇴용: 해당 회원이 작성한 posts 문서 목록(authorId·구버전 author 일치)
   */
  async getPostsByUserForPurge(userProfile) {
    const rawIds = [userProfile?.id, userProfile?.uid].filter(Boolean).map(String);
    const idSet = new Set(rawIds);
    const byId = new Map();
    for (const uid of idSet) {
      if (!uid) continue;
      try {
        const q = query(collection(db, 'posts'), where('authorId', '==', uid));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          byId.set(d.id, { id: d.id, ...d.data() });
        });
      } catch (e) {
        console.warn('getPostsByUserForPurge authorId', uid, e);
      }
    }
    const name = (userProfile?.name || '').toString().trim();
    if (name) {
      try {
        const q2 = query(collection(db, 'posts'), where('author', '==', name));
        const snap2 = await getDocs(q2);
        snap2.forEach((d) => {
          const data = d.data() || {};
          const aid = data.authorId != null && data.authorId !== '' ? String(data.authorId) : '';
          if (aid) {
            if (idSet.has(aid)) byId.set(d.id, { id: d.id, ...data });
            return;
          }
          byId.set(d.id, { id: d.id, ...data });
        });
      } catch (e) {
        console.warn('getPostsByUserForPurge author name', e);
      }
    }
    return [...byId.values()];
  },

  /**
   * 회원 탈퇴·강제 탈퇴: 신청·게시글(이미지 호스팅 포함)·본인 맛집·알림·결제대기 문서 정리
   * 이후 deleteUser / deleteAuthUser 호출
   */
  async purgeUserRelatedData(userProfile) {
    if (!userProfile) return;
    const uidA = String(userProfile.id || userProfile.uid || '').trim();
    const uidB = String(userProfile.uid || userProfile.id || '').trim();
    const idSet = new Set([uidA, uidB].filter(Boolean));
    if (idSet.size === 0) return;

    const uForApps = { ...userProfile, id: uidA || uidB, uid: uidB || uidA };
    const apps = await this.getApplicationsForUser(uForApps);
    for (const a of apps) {
      if (a.id) {
        try {
          await deleteDoc(doc(db, 'applications', a.id));
        } catch (e) {
          console.warn('purge application', a.id, e);
        }
      }
    }

    const posts = await this.getPostsByUserForPurge(userProfile);
    for (const p of posts) {
      if (!p.id) continue;
      try {
        await deleteHostedImagesForPayload(p);
        await deleteDoc(doc(db, 'posts', p.id));
      } catch (e) {
        console.warn('purge post', p.id, e);
      }
    }

    for (const idUser of idSet) {
      try {
        const rq = query(collection(db, 'restaurants'), where('ownerId', '==', idUser));
        const rs = await getDocs(rq);
        for (const d of rs.docs) {
          const r = { id: d.id, ...d.data() };
          try {
            await deleteHostedImagesForPayload(r);
            await deleteDoc(d.ref);
          } catch (e) {
            console.warn('purge restaurant', d.id, e);
          }
        }
      } catch (e) {
        console.warn('purge restaurants query', e);
      }
    }

    for (const idUser of idSet) {
      try {
        const nref = collection(db, 'users', idUser, 'notifications');
        const ns = await getDocs(nref);
        let batch = writeBatch(db);
        let c = 0;
        for (const nd of ns.docs) {
          batch.delete(nd.ref);
          c++;
          if (c >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            c = 0;
          }
        }
        if (c > 0) await batch.commit();
      } catch (e) {
        console.warn('purge notifications', idUser, e);
      }
    }

    try {
      const pps = await getDocs(collection(db, 'pendingPayments'));
      for (const d of pps.docs) {
        const x = d.data() || {};
        const pu = String(x.user_id ?? x.userId ?? '').trim();
        if (pu && idSet.has(pu)) {
          try {
            await deleteDoc(d.ref);
          } catch (e) {
            console.warn('purge pending', d.id, e);
          }
        }
      }
    } catch (e) {
      console.warn('purge pendingPayments', e);
    }
  },

  subscribePosts(callback) {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(posts);
    });
  },

  // ==========================================
  // Applications Collection
  // ==========================================
  async getApplications() {
    // orderBy('createdAt')는 해당 필드가 없는 문서를 쿼리 결과에서 빼므로 사용하지 않음(누락 방지).
    try {
      const snapshot = await getDocs(collection(db, 'applications'));
      const list = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
      const toMs = (v) => {
        if (!v) return 0;
        if (v.toMillis && typeof v.toMillis === 'function') return v.toMillis();
        if (v.seconds != null) return v.seconds * 1000;
        return new Date(v).getTime() || 0;
      };
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
      return list;
    } catch (error) {
      console.error('Error getting applications:', error);
      throw error;
    }
  },

  /**
   * 결제 대기(pendingPayments) 목록 조회.
   * 신청자 명단에 결제 미완료 건도 포함해 보여주기 위해 applications와 동일한 필드 형태로 정규화하여 반환.
   */
  async getPendingPayments() {
    try {
      const snapshot = await getDocs(collection(db, 'pendingPayments'));
      const toMs = (v) => {
        if (!v) return 0;
        if (v && typeof v.toMillis === 'function') return v.toMillis();
        if (v && v.seconds != null) return v.seconds * 1000;
        return new Date(v).getTime() || 0;
      };
      return snapshot.docs.map((d) => {
        const raw = d.data();
        const appData = raw.application_data || raw.applicationData || {};
        return {
          id: d.id,
          seminarId: raw.seminar_id ?? raw.seminarId,
          programId: raw.seminar_id ?? raw.seminarId,
          userId: raw.user_id ?? raw.userId,
          userName: raw.user_name ?? raw.userName ?? '',
          userEmail: raw.user_email ?? raw.userEmail ?? '',
          userPhone: raw.user_phone ?? raw.userPhone ?? '',
          participationPath: appData.participationPath ?? '',
          applyReason: appData.applyReason ?? '',
          preQuestions: appData.preQuestions ?? '',
          mealAfter: appData.mealAfter ?? '',
          privacyAgreed: appData.privacyAgreed === true,
          createdAt: raw.createdAt,
          _isPending: true
        };
      }).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    } catch (error) {
      console.warn('getPendingPayments failed:', error?.message);
      return [];
    }
  },

  async getApplicationsByUserId(userId) {
    try {
      // orderBy를 제거하여 인덱스 불필요하도록 수정
      const q = query(
        collection(db, 'applications'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const applications = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));

      // 클라이언트 측에서 정렬 (createdAt 기준 내림차순)
      return applications.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime; // 내림차순 (최신순)
      });
    } catch (error) {
      console.error('Error getting applications by userId:', error);
      // 인덱스 오류인 경우 사용자에게 안내
      if (error.code === 'failed-precondition') {
        console.warn('Firestore 인덱스가 필요합니다. 관리자에게 문의하세요.');
      }
      throw error;
    }
  },

  /**
   * 사용자(id, 이메일, 연락처) 기준으로 신청 목록 조회.
   * 동일인이라도 userId가 다른 경우(다른 로그인 수단 등) 이메일/연락처로 연결해 '내가 신청한 모임'에 포함.
   */
  async getApplicationsForUser(user) {
    if (!user) return [];
    const idSet = new Set();
    [user.id, user.uid].filter(Boolean).forEach((id) => idSet.add(String(id)));
    const normEmail = (v) => (v && String(v).trim().toLowerCase()) || '';
    const normPhone = (v) => (v && String(v).replace(/\D/g, '')) || '';
    const userEmail = normEmail(user.email);
    const userPhone = normPhone(user.phone || user.phoneNumber);

    const byId = [];
    for (const uid of idSet) {
      try {
        const list = await this.getApplicationsByUserId(uid);
        byId.push(...list);
      } catch (e) {
        // ignore
      }
    }

    if (!userEmail && !userPhone) {
      const seen = new Set();
      return byId.filter((app) => {
        const k = app.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime;
      });
    }

    let byEmailPhone = [];
    try {
      const all = await this.getApplications();
      byEmailPhone = all.filter((app) => {
        if (idSet.has(String(app.userId))) return false;
        if (userEmail && normEmail(app.userEmail) === userEmail) return true;
        if (userPhone && normPhone(app.userPhone || app.userPhoneNumber) === userPhone) return true;
        return false;
      });
    } catch (e) {
      // getApplications 실패 시 id로 찾은 것만 반환
    }

    const seen = new Set(byId.map((a) => a.id).filter(Boolean));
    const merged = [...byId];
    byEmailPhone.forEach((app) => {
      if (app.id && !seen.has(app.id)) {
        seen.add(app.id);
        merged.push(app);
      }
    });
    merged.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return bTime - aTime;
    });
    return merged;
  },

  async getApplication(applicationId) {
    try {
      const docRef = doc(db, 'applications', applicationId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id };
      }
      return null;
    } catch (error) {
      console.error('Error getting application:', error);
      throw error;
    }
  },

  async createApplication(applicationData) {
    try {
      const docRef = await addDoc(collection(db, 'applications'), {
        ...applicationData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating application:', error);
      throw error;
    }
  },

  /**
   * 신청 내용 정정 시 허용 필드만 병합하여 seminarId/userId 등이 덮어쓰이지 않도록 함.
   * 미허용 필드는 제거해 신청자 목록에서 누락되지 않게 함.
   */
  async updateApplication(applicationId, applicationData) {
    try {
      const allowed = ['participationPath', 'applyReason', 'preQuestions', 'mealAfter', 'privacyAgreed', 'reason', 'questions'];
      const payload = { updatedAt: serverTimestamp() };
      for (const key of allowed) {
        if (applicationData && key in applicationData && applicationData[key] !== undefined) payload[key] = applicationData[key];
      }
      const docRef = doc(db, 'applications', applicationId);
      await updateDoc(docRef, payload);
    } catch (error) {
      console.error('Error updating application:', error);
      throw error;
    }
  },

  async deleteApplication(applicationId) {
    try {
      await deleteDoc(doc(db, 'applications', applicationId));
    } catch (error) {
      console.error('Error deleting application:', error);
      throw error;
    }
  },

  subscribeApplications(callback) {
    const toMs = (v) => {
      if (!v) return 0;
      if (v.toMillis && typeof v.toMillis === 'function') return v.toMillis();
      if (v.seconds != null) return v.seconds * 1000;
      return new Date(v).getTime() || 0;
    };
    return onSnapshot(collection(db, 'applications'), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
      callback(list);
    });
  },

  // ==========================================
  // Settings Collection
  // ==========================================
  async getSettings() {
    try {
      const docRef = doc(db, 'settings', 'main');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return {};
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  },

  async updateSettings(settingsData) {
    try {
      const docRef = doc(db, 'settings', 'main');
      await setDoc(docRef, {
        ...settingsData,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  },

  subscribeSettings(callback) {
    const docRef = doc(db, 'settings', 'main');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        callback({});
      }
    });
  },

  // ==========================================
  // Bulk Delete Functions
  // ==========================================
  async deleteAllUsers(exceptEmail) {
    try {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, 'users'));
      let deletedCount = 0;
      
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!exceptEmail || data.email !== exceptEmail) {
          batch.delete(docSnap.ref);
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`✅ ${deletedCount}명의 사용자가 삭제되었습니다.`);
      } else {
        console.log('삭제할 사용자가 없습니다.');
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error deleting all users:', error);
      throw error;
    }
  },

  async deleteAllSeminars() {
    try {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, 'seminars'));
      let deletedCount = 0;
      
      snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
        deletedCount++;
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`✅ ${deletedCount}개의 프로그램이 삭제되었습니다.`);
      } else {
        console.log('삭제할 프로그램이 없습니다.');
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error deleting all seminars:', error);
      throw error;
    }
  },

  async deleteAllPosts() {
    try {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, 'posts'));
      let deletedCount = 0;
      
      snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
        deletedCount++;
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`✅ ${deletedCount}개의 게시글이 삭제되었습니다.`);
      } else {
        console.log('삭제할 게시글이 없습니다.');
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error deleting all posts:', error);
      throw error;
    }
  },

  async deleteAllApplications() {
    try {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, 'applications'));
      let deletedCount = 0;
      
      snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
        deletedCount++;
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`✅ ${deletedCount}개의 신청이 삭제되었습니다.`);
      } else {
        console.log('삭제할 신청이 없습니다.');
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error deleting all applications:', error);
      throw error;
    }
  },

  async resetSettings(defaultSettings) {
    try {
      const docRef = doc(db, 'settings', 'main');
      await setDoc(docRef, {
        ...defaultSettings,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Settings가 기본값으로 초기화되었습니다.');
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw error;
    }
  },

  // ==========================================
  // SearchLogs Collection
  // ==========================================
  async createSearchLog(logData) {
    try {
      const docRef = await addDoc(collection(db, 'searchLogs'), {
        ...logData,
        searchedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating search log:', error);
      throw error;
    }
  },

  async getSearchLogs(limitCount = 50) {
    try {
      let q = query(collection(db, 'searchLogs'), orderBy('searchedAt', 'desc'));
      
      if (limitCount > 0) {
        q = query(q, limit(limitCount));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return { 
          id: docSnap.id, 
          ...data,
          searchedAt: data.searchedAt?.toDate ? data.searchedAt.toDate() : data.searchedAt
        };
      });
    } catch (error) {
      console.error('Error getting search logs:', error);
      throw error;
    }
  },

  subscribeSearchLogs(callback, limitCount = 50) {
    try {
      let q = query(collection(db, 'searchLogs'), orderBy('searchedAt', 'desc'));
      
      if (limitCount > 0) {
        q = query(q, limit(limitCount));
      }
      
      return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return { 
            id: docSnap.id, 
            ...data,
            searchedAt: data.searchedAt?.toDate ? data.searchedAt.toDate() : data.searchedAt
          };
        });
        callback(logs);
      }, (error) => {
        console.error('Error in search logs subscription:', error);
      });
    } catch (error) {
      console.error('Error subscribing to search logs:', error);
      throw error;
    }
  },

  // ==========================================
  // Restaurants Collection
  // ==========================================
  async getRestaurants() {
    try {
      const q = query(collection(db, 'restaurants'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting restaurants:', error);
      throw error;
    }
  },

  async getRestaurant(restaurantId) {
    try {
      const docRef = doc(db, 'restaurants', restaurantId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting restaurant:', error);
      throw error;
    }
  },

  async createRestaurant(restaurantData) {
    try {
      const docRef = await addDoc(collection(db, 'restaurants'), {
        ...restaurantData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating restaurant:', error);
      throw error;
    }
  },

  async updateRestaurant(restaurantId, restaurantData) {
    try {
      const docRef = doc(db, 'restaurants', restaurantId);
      await updateDoc(docRef, {
        ...restaurantData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating restaurant:', error);
      throw error;
    }
  },

  async deleteRestaurant(restaurantId) {
    try {
      const id = String(restaurantId || '').trim();
      if (!id) return;
      const ref = doc(db, 'restaurants', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() || {};
        await deleteHostedImagesForPayload({ id, ...data });
      }
      await deleteDoc(ref);
    } catch (error) {
      console.error('Error deleting restaurant:', error);
      throw error;
    }
  },

  subscribeRestaurants(callback) {
    const q = query(collection(db, 'restaurants'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const restaurants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(restaurants);
      },
      async (error) => {
        console.error('subscribeRestaurants error:', error);
        try {
          const restaurants = await this.getRestaurants();
          callback(restaurants);
        } catch (fallbackError) {
          console.error('getRestaurants fallback error:', fallbackError);
          callback([]);
        }
      }
    );
  },

  // ==========================================
  // Site Content Collection
  // ==========================================
  async getContent() {
    try {
      const docRef = doc(db, 'siteContent', 'main');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data().content || {};
      }
      
      // 문서가 없으면 빈 객체 반환 (defaultContent는 클라이언트에서 처리)
      return {};
    } catch (error) {
      console.error('Error getting content:', error);
      throw error;
    }
  },

  async updateContent(contentData, userId) {
    try {
      const docRef = doc(db, 'siteContent', 'main');
      
      // setDoc을 사용하여 문서가 없으면 생성, 있으면 업데이트
      await setDoc(docRef, {
        content: contentData,
        updatedAt: serverTimestamp(),
        updatedBy: userId || 'anonymous'
      }, { merge: true });
      
      return true;
    } catch (error) {
      console.error('Error updating content:', error);
      throw error;
    }
  },

  subscribeContent(callback) {
    const docRef = doc(db, 'siteContent', 'main');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data().content || {});
      } else {
        callback({});
      }
    });
  },

  // ==========================================
  // External event posters (기간제 홈 팝업)
  // ==========================================
  subscribeExternalEventPosters(callback) {
    return onSnapshot(
      collection(db, 'externalEventPosters'),
      (snapshot) => {
        const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
        callback(rows);
      },
      (error) => {
        console.error('subscribeExternalEventPosters error:', error);
        callback([]);
      }
    );
  },

  async createExternalEventPoster(data) {
    const docRef = await addDoc(collection(db, 'externalEventPosters'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateExternalEventPoster(posterId, data) {
    const id = String(posterId || '').trim();
    if (!id) throw new Error('updateExternalEventPoster: posterId가 비어 있습니다.');
    await updateDoc(doc(db, 'externalEventPosters', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteExternalEventPoster(posterId) {
    const id = String(posterId || '').trim();
    if (!id) return;
    try {
      const ref = doc(db, 'externalEventPosters', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() || {};
        await deleteHostedImagesForPayload({ id, ...data });
      }
      await deleteDoc(ref);
    } catch (e) {
      console.error('deleteExternalEventPoster', e);
      throw e;
    }
  },
};

export default firebaseService;



