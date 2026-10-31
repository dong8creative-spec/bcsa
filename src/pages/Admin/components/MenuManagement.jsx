import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { firebaseService } from '../../../services/firebaseService';
import { authService } from '../../../services/authService';
import { defaultMenuOrder, defaultMenuNames } from '../../../constants/content';
import { buildSiteContent, getMenuStateFromSiteContent, mergeLiveContent } from '../../../utils/siteContent';
import { Icons } from '../../../components/Icons';
import { AdminPageHeader, adminAlert, adminConfirm, adminPrompt, btn } from './ui';

/**
 * 드래그 가능한 메뉴 아이템 컴포넌트
 */
const SortableMenuItem = ({ id, enabled, name, onToggle, onNameChange }) => {
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
      className="bg-white border border-black/10 rounded-lg p-4 hover:shadow-lg transition-all"
    >
      <div className="flex items-center gap-4">
        {/* 드래그 핸들 */}
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="드래그하여 순서 변경"
        >
          <Icons.GripVertical size={20} className="text-slate-400" />
        </button>

        {/* 활성화 토글 */}
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            className="w-5 h-5 text-brand focus:ring-brand border-blue-300 rounded cursor-pointer"
          />
        </div>

        {/* 명칭 수정 */}
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={onNameChange}
            className="w-full px-4 py-2 border border-black/10 rounded-lg focus:border-brand focus:outline-none font-bold"
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
            <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold">
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
      
      // 실제 사이트와 같은 순서로 병합(코드 기본값 → 배포본 → 관리자 저장값)해 지금 보이는 메뉴를 그대로 보여준다.
      const saved = await firebaseService.getContent();
      const live = getMenuStateFromSiteContent(mergeLiveContent(buildSiteContent(), saved));
      setMenuOrder(live.menuOrder);
      setMenuEnabled(live.menuEnabled);
      setMenuNames(live.menuNames);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      adminAlert('데이터를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;
    setMenuOrder((items) => {
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
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
    if (!await adminConfirm('메뉴 설정을 저장할까요? 저장하면 사이트 메뉴에 바로 반영돼요.', { okText: '저장' })) return;

    try {
      setIsSaving(true);

      // Firebase에 저장
      const contentData = await firebaseService.getContent();
      const payload = {
        ...mergeLiveContent(buildSiteContent(), contentData),
        liveSync: true,
        menuOrder,
        menuEnabled,
        menuNames
      };
      await firebaseService.updateContent(payload, currentUser?.uid);

      adminAlert('저장했어요. 사이트 메뉴에 바로 반영돼요.');
    } catch (error) {
      console.error('저장 오류:', error);
      adminAlert('메뉴 설정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4"></div>
          <p className="text-slate-600">메뉴 설정 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="메뉴"
        description="끌어서 순서를 바꾸고, 보일지 말지와 이름을 정해요. 저장하면 사이트 메뉴에 바로 반영돼요."
        actions={
          <button type="button" onClick={handleSave} disabled={isSaving} className={btn('primary')}>
            <Icons.Save size={16} />{isSaving ? '저장 중…' : '저장'}
          </button>
        }
      />

      {/* 안내 메시지 */}
      <div className="bg-soft rounded-2xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Icons.Info size={20} className="text-brand mt-0.5" />
          <div>
            <p className="text-sm font-bold text-dark mb-1">사용 방법</p>
            <ul className="text-sm text-slate-600 space-y-1">
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
      <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-black/10">
        <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
          <Icons.Eye size={20} />
          메뉴 미리보기
        </h3>
        <div className="flex flex-wrap gap-3">
          {menuOrder.filter(menuKey => menuEnabled[menuKey] !== false).map((menuKey, idx) => (
            <div
              key={menuKey}
              className="px-4 py-2 bg-brand text-white rounded-lg font-bold shadow-sm"
            >
              {idx + 1}. {menuNames[menuKey] || menuKey}
            </div>
          ))}
        </div>
        {menuOrder.filter(menuKey => menuEnabled[menuKey] !== false).length === 0 && (
          <p className="text-slate-500 text-sm">활성화된 메뉴가 없습니다.</p>
        )}
      </div>
    </div>
  );
};
