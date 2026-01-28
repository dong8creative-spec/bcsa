import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { firebaseService } from '../../../services/firebaseService';
import { authService } from '../../../services/authService';
import { Icons } from '../../../components/Icons';

/**
 * 드래그 가능한 메뉴 아이템 컴포넌트
 */
const SortableMenuItem = ({ id, menu, enabled, name, onToggle, onNameChange }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all"
    >
      <div className="flex items-center gap-4">
        {/* 드래그 핸들 */}
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="드래그하여 순서 변경"
        >
          <Icons.GripVertical size={20} className="text-gray-400" />
        </button>

        {/* 활성화 토글 */}
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            className="w-5 h-5 text-brand focus:ring-brand border-gray-300 rounded cursor-pointer"
          />
        </div>

        {/* 메뉴 키 (변경 불가) */}
        <div className="flex-1 min-w-[120px]">
          <span className="text-sm font-bold text-gray-500 px-3 py-1 bg-gray-100 rounded-lg">
            {id}
          </span>
        </div>

        {/* 명칭 수정 */}
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={onNameChange}
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-brand focus:outline-none font-bold"
            placeholder="메뉴 명칭"
          />
        </div>

        {/* 상태 표시 */}
        <div className="min-w-[80px] text-center">
          {enabled ? (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
              활성화
            </span>
          ) : (
            <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">
              비활성화
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 메뉴 관리 컴포넌트
 */
export const MenuManagement = () => {
  const defaultMenuOrder = ['홈', '소개', '프로그램', '부청사 회원', '커뮤니티', '후원', '부산맛집', '입찰공고'];
  
  const [menuOrder, setMenuOrder] = useState(defaultMenuOrder);
  const [menuEnabled, setMenuEnabled] = useState({});
  const [menuNames, setMenuNames] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    loadData();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('사용자 정보 로드 오류:', error);
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Firebase에서 콘텐츠 로드
      const contentData = await firebaseService.getContent();
      
      // menuOrder 로드
      if (contentData.menuOrder && Array.isArray(contentData.menuOrder)) {
        setMenuOrder(contentData.menuOrder);
      } else if (localStorage.getItem('busan_ycc_menu_order')) {
        const stored = JSON.parse(localStorage.getItem('busan_ycc_menu_order'));
        setMenuOrder(stored);
      }
      
      // menuEnabled 로드
      if (contentData.menuEnabled) {
        setMenuEnabled(contentData.menuEnabled);
      } else if (localStorage.getItem('busan_ycc_menu_enabled')) {
        const stored = JSON.parse(localStorage.getItem('busan_ycc_menu_enabled'));
        setMenuEnabled(stored);
      } else {
        // 기본값: 모두 활성화
        const defaultEnabled = {};
        defaultMenuOrder.forEach(menu => {
          defaultEnabled[menu] = true;
        });
        setMenuEnabled(defaultEnabled);
      }
      
      // menuNames 로드
      if (contentData.menuNames) {
        setMenuNames(contentData.menuNames);
      } else if (localStorage.getItem('busan_ycc_menu_names')) {
        const stored = JSON.parse(localStorage.getItem('busan_ycc_menu_names'));
        setMenuNames(stored);
      } else {
        // 기본값: 키와 동일
        const defaultNames = {};
        defaultMenuOrder.forEach(menu => {
          defaultNames[menu] = menu;
        });
        setMenuNames(defaultNames);
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      alert('데이터를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setMenuOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleToggle = (menuKey) => {
    setMenuEnabled(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  const handleNameChange = (menuKey, newName) => {
    setMenuNames(prev => ({
      ...prev,
      [menuKey]: newName
    }));
  };

  const handleSave = async () => {
    if (!confirm('메뉴 설정을 저장하시겠습니까?')) return;

    try {
      setIsSaving(true);

      // Firebase에 저장
      const contentData = await firebaseService.getContent();
      await firebaseService.updateContent({
        ...contentData,
        menuOrder,
        menuEnabled,
        menuNames
      }, currentUser?.uid);

      // localStorage에도 저장 (폴백용)
      localStorage.setItem('busan_ycc_menu_order', JSON.stringify(menuOrder));
      localStorage.setItem('busan_ycc_menu_enabled', JSON.stringify(menuEnabled));
      localStorage.setItem('busan_ycc_menu_names', JSON.stringify(menuNames));

      // 커스텀 이벤트 발생 (App.jsx에서 감지)
      window.dispatchEvent(new Event('menuNamesUpdated'));
      window.dispatchEvent(new Event('storage'));

      alert('메뉴 설정이 저장되었습니다.');
    } catch (error) {
      console.error('저장 오류:', error);
      alert('메뉴 설정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('메뉴 설정을 기본값으로 초기화하시겠습니까?')) return;

    setMenuOrder(defaultMenuOrder);
    const defaultEnabled = {};
    const defaultNames = {};
    defaultMenuOrder.forEach(menu => {
      defaultEnabled[menu] = true;
      defaultNames[menu] = menu;
    });
    setMenuEnabled(defaultEnabled);
    setMenuNames(defaultNames);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4"></div>
          <p className="text-gray-600">메뉴 설정 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-dark flex items-center gap-3">
            <Icons.Menu size={28} />
            메뉴 관리
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            드래그하여 메뉴 순서를 변경하고, 활성화 여부와 명칭을 수정할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Icons.RotateCcw size={18} />
            초기화
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icons.Save size={18} />
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Icons.Info size={20} className="text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-900 mb-1">사용 방법</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 좌측 아이콘을 드래그하여 메뉴 순서를 변경할 수 있습니다.</li>
              <li>• 체크박스를 클릭하여 메뉴 표시 여부를 설정할 수 있습니다.</li>
              <li>• 입력창에서 메뉴 명칭을 수정할 수 있습니다.</li>
              <li>• 변경사항은 저장 버튼을 클릭해야 적용됩니다.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 메뉴 목록 */}
      <div className="space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={menuOrder}
            strategy={verticalListSortingStrategy}
          >
            {menuOrder.map((menuKey) => (
              <SortableMenuItem
                key={menuKey}
                id={menuKey}
                menu={menuKey}
                enabled={menuEnabled[menuKey] !== false}
                name={menuNames[menuKey] || menuKey}
                onToggle={() => handleToggle(menuKey)}
                onNameChange={(e) => handleNameChange(menuKey, e.target.value)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* 미리보기 */}
      <div className="mt-8 p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
        <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
          <Icons.Eye size={20} />
          메뉴 미리보기
        </h3>
        <div className="flex flex-wrap gap-3">
          {menuOrder.filter(menuKey => menuEnabled[menuKey] !== false).map((menuKey, idx) => (
            <div
              key={menuKey}
              className="px-4 py-2 bg-brand text-white rounded-xl font-bold shadow-sm"
            >
              {idx + 1}. {menuNames[menuKey] || menuKey}
            </div>
          ))}
        </div>
        {menuOrder.filter(menuKey => menuEnabled[menuKey] !== false).length === 0 && (
          <p className="text-gray-500 text-sm">활성화된 메뉴가 없습니다.</p>
        )}
      </div>
    </div>
  );
};
