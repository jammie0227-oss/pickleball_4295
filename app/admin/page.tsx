"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const getEmptyDayPricing = () => Array(24).fill({ isOpen: false, price: 0 });

export default function AdminPage() {
  const [adminTab, setAdminTab] = useState<'venues' | 'users'>('venues'); // 新增：後台頁籤狀態
  
  const [venues, setVenues] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]); // 新增：儲存所有成員資料

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [note, setNote] = useState('');
  const [courtNames, setCourtNames] = useState<string[]>([]);
  const [newCourtInput, setNewCourtInput] = useState('');

  const [weekdayPricing, setWeekdayPricing] = useState(getEmptyDayPricing());
  const [saturdayPricing, setSaturdayPricing] = useState(getEmptyDayPricing());
  const [sundayPricing, setSundayPricing] = useState(getEmptyDayPricing());

  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [batchPrice, setBatchPrice] = useState<number | ''>('');

  useEffect(() => {
    const unsubVenues = onSnapshot(collection(db, 'venues'), (snapshot) => {
      const loadedVenues: any[] = [];
      snapshot.forEach((doc) => { loadedVenues.push({ id: doc.id, ...doc.data() }); });
      loadedVenues.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setVenues(loadedVenues);
    });

    // ✨ 新增：監聽所有的成員資料
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const loadedUsers: any[] = [];
      snapshot.forEach((doc) => { loadedUsers.push({ id: doc.id, ...doc.data() }); });
      setAllUsers(loadedUsers);
    });

    return () => { unsubVenues(); unsubUsers(); };
  }, []);

  // --- 場地管理邏輯 ---
  const openAddModal = () => {
    setEditingId(null); setName(''); setMapUrl(''); setBookingUrl(''); setCourtNames([]);setNote('');
    setWeekdayPricing(getEmptyDayPricing()); setSaturdayPricing(getEmptyDayPricing()); setSundayPricing(getEmptyDayPricing());
    setSelectedHours([]); setIsModalOpen(true);
  };

  const openEditModal = (venue: any) => {
    setEditingId(venue.id); setName(venue.name); setMapUrl(venue.mapUrl || ''); setBookingUrl(venue.bookingUrl || '');
    setCourtNames(venue.courtNames || []);
    setNote(venue.note || '');
    setWeekdayPricing(venue.weekdayPricing || getEmptyDayPricing());
    setSaturdayPricing(venue.saturdayPricing || venue.weekendPricing || getEmptyDayPricing());
    setSundayPricing(venue.sundayPricing || venue.weekendPricing || getEmptyDayPricing());
    setSelectedHours([]); setIsModalOpen(true);
  };

  const handleAddCourt = () => {
    if (newCourtInput.trim() && !courtNames.includes(newCourtInput.trim())) {
      setCourtNames([...courtNames, newCourtInput.trim()]); setNewCourtInput('');
    }
  };
  const handleRemoveCourt = (target: string) => setCourtNames(courtNames.filter(c => c !== target));

  const toggleHourSelection = (hour: number) => {
    setSelectedHours(prev => prev.includes(hour) ? prev.filter(h => h !== hour) : [...prev, hour].sort((a, b) => a - b));
  };

  const selectAll = () => setSelectedHours(Array.from({length: 24}, (_, i) => i));
  const selectDaytime = () => setSelectedHours(Array.from({length: 12}, (_, i) => i + 6));
  const selectNight = () => setSelectedHours(Array.from({length: 6}, (_, i) => i + 18));
  const clearSelection = () => setSelectedHours([]);

  const applyPricing = (target: 'weekday' | 'saturday' | 'sunday' | 'closed') => {
    if (selectedHours.length === 0) return alert('請先點選下方列表的時段！');
    if (target !== 'closed' && batchPrice === '') return alert('請輸入金額！');

    const newSetting = { isOpen: target !== 'closed', price: target !== 'closed' ? Number(batchPrice) : 0 };
    
    if (target === 'weekday' || target === 'closed') {
      const newPricing = [...weekdayPricing]; selectedHours.forEach(h => newPricing[h] = newSetting); setWeekdayPricing(newPricing);
    }
    if (target === 'saturday' || target === 'closed') {
      const newPricing = [...saturdayPricing]; selectedHours.forEach(h => newPricing[h] = newSetting); setSaturdayPricing(newPricing);
    }
    if (target === 'sunday' || target === 'closed') {
      const newPricing = [...sundayPricing]; selectedHours.forEach(h => newPricing[h] = newSetting); setSundayPricing(newPricing);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || courtNames.length === 0) return alert('請填寫場地名稱，並至少新增一個場地選項！');
    const venueData = { name: name.trim(), mapUrl: mapUrl.trim(), bookingUrl: bookingUrl.trim(), note: note.trim(), courtNames, maxCourts: courtNames.length, weekdayPricing, saturdayPricing, sundayPricing };
    if (editingId) await updateDoc(doc(db, 'venues', editingId), venueData);
    else await addDoc(collection(db, 'venues'), { ...venueData, order: venues.length });
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除這個場地嗎？')) await deleteDoc(doc(db, 'venues', id));
  };

  // ✨ 場地排序：交換兩個相鄰場地的 order 值
  const handleMoveVenue = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= venues.length) return;
    const a = venues[index];
    const b = venues[targetIndex];
    const orderA = a.order ?? index;
    const orderB = b.order ?? targetIndex;
    await Promise.all([
      updateDoc(doc(db, 'venues', a.id), { order: orderB }),
      updateDoc(doc(db, 'venues', b.id), { order: orderA }),
    ]);
  };

  // --- ✨ 成員管理邏輯 (升級版：自動清除未來報名紀錄) ---
  const handleDeleteUser = async (id: string, userName: string) => {
    if (confirm(`確定要刪除「${userName}」的資料嗎？這個操作無法復原！\n(系統將自動把他從「未來」的活動中移除，但會保留在過去的歷史紀錄中)`)) {
      
      // 1. 先刪除 users 資料庫中的該名成員
      await deleteDoc(doc(db, 'users', id));

      // 2. 啟動自動清道夫：抓出所有活動
      const eventsSnapshot = await getDocs(collection(db, 'events'));
      const todayObj = new Date();
      todayObj.setHours(0, 0, 0, 0);

      const updatePromises: Promise<void>[] = [];

      eventsSnapshot.forEach((eventDoc) => {
        const eventDateStr = eventDoc.id; 
        const eventDateObj = new Date(eventDateStr);
        eventDateObj.setHours(0, 0, 0, 0);

        // 💡 只有「未來或今天」的活動才處理，過去的保留
        if (eventDateObj >= todayObj) {
          const eventData = eventDoc.data();
          let needsUpdate = false;
          
          let newPlayers = eventData.players || [];
          let newIsBooked = eventData.isBooked;
          let newHost = eventData.host;
          let newTimeInfo = eventData.timeInfo;
          let newHostCourtsInfo = eventData.hostCourtsInfo;
          let newTotalPrice = eventData.totalPrice;
          let newVenue = eventData.venue;

          // 狀況A：如果他是這場的主揪，整場退掉恢復成「揪團中」
          if (eventData.isBooked && eventData.host?.id === id) {
            newIsBooked = false;
            newHost = null;
            newTimeInfo = null;
            newHostCourtsInfo = [];
            newTotalPrice = 0;
            newVenue = null;
            needsUpdate = true;
          }

          // 狀況B：如果他在報名名單裡，把他移除
          if (newPlayers.some((p: any) => p.id === id)) {
            newPlayers = newPlayers.filter((p: any) => p.id !== id);
            needsUpdate = true;
          }

          // 狀況C：如果把他移除後，名單變成 0 個人了，連帶把場地退掉
          if (newPlayers.length === 0 && newIsBooked) {
            newIsBooked = false;
            newHost = null;
            newTimeInfo = null;
            newHostCourtsInfo = [];
            newTotalPrice = 0;
            newVenue = null;
            needsUpdate = true;
          }

          // 如果有任何更動，就把更新任務推入排程
          if (needsUpdate) {
            updatePromises.push(
              updateDoc(doc(db, 'events', eventDateStr), {
                players: newPlayers,
                isBooked: newIsBooked,
                host: newHost,
                timeInfo: newTimeInfo,
                hostCourtsInfo: newHostCourtsInfo,
                totalPrice: newTotalPrice,
                venue: newVenue
              })
            );
          }
        }
      });

      // 3. 一口氣執行所有日曆的更新
      await Promise.all(updatePromises);
      alert('成員與相關未來報名紀錄已成功刪除！');
    }
  };

  const getSummaryBlocks = (venue: any) => {
    const blocks = []; let currentBlock: any = null;
    const wDay = venue.weekdayPricing || getEmptyDayPricing(); const sat = venue.saturdayPricing || venue.weekendPricing || getEmptyDayPricing(); const sun = venue.sundayPricing || venue.weekendPricing || getEmptyDayPricing();

    for (let i = 0; i < 24; i++) {
      const hash = `${wDay[i].isOpen}-${wDay[i].price}-${sat[i].isOpen}-${sat[i].price}-${sun[i].isOpen}-${sun[i].price}`;
      if (!currentBlock) currentBlock = { start: i, end: i + 1, hash, wDay: wDay[i], sat: sat[i], sun: sun[i] };
      else if (currentBlock.hash === hash) currentBlock.end = i + 1;
      else { blocks.push(currentBlock); currentBlock = { start: i, end: i + 1, hash, wDay: wDay[i], sat: sat[i], sun: sun[i] }; }
    }
    if (currentBlock) blocks.push(currentBlock);
    return blocks.filter(b => b.wDay.isOpen || b.sat.isOpen || b.sun.isOpen);
  };

  const getPriceExtremes = (venue: any) => {
    let prices: number[] = [];
    const collect = (dayArr: any[]) => dayArr?.forEach(h => { if (h.isOpen && h.price > 0) prices.push(h.price); });
    collect(venue.weekdayPricing); collect(venue.saturdayPricing || venue.weekendPricing); collect(venue.sundayPricing || venue.weekendPricing);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  };

  const getHeatmapClass = (isOpen: boolean, price: number, min: number, max: number) => {
    if (!isOpen) return 'text-gray-300';
    if (min === max) return 'text-gray-700 font-bold';
    if (price === max) return 'bg-rose-50 text-rose-600 font-bold';
    if (price === min) return 'bg-emerald-50 text-emerald-600 font-bold';
    return 'text-gray-700 font-bold';
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4 font-sans relative overflow-hidden">
      <div className="w-full max-w-md flex items-center mb-6 px-2 relative">
        <Link href="/calendar" className="absolute left-2 text-gray-400 text-sm hover:text-gray-600 font-bold">◀ 返回日曆</Link>
        <h2 className="w-full text-center text-xl font-bold text-gray-800">⚙️ 群組營運後台</h2>
      </div>

      {/* ✨ 後台主要頁籤切換 */}
      <div className="w-full max-w-md flex space-x-2 mb-6">
        <button onClick={() => setAdminTab('venues')} className={`flex-1 py-3 font-bold rounded-2xl transition-colors ${adminTab === 'venues' ? 'bg-emerald-500 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}>🏟️ 場地管理</button>
        <button onClick={() => setAdminTab('users')} className={`flex-1 py-3 font-bold rounded-2xl transition-colors ${adminTab === 'users' ? 'bg-blue-500 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}>👥 成員管理</button>
      </div>

      <div className="w-full max-w-md space-y-6 pb-20">
        
        {/* === 場地管理頁籤 === */}
        {adminTab === 'venues' && (
          <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-gray-800 font-bold flex items-center text-base"><span className="text-emerald-500 mr-2 text-xl">🏟️</span> 場地課表管理</h3>
              <button onClick={openAddModal} className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg font-bold shadow-sm active:scale-95">＋ 新增場地</button>
            </div>
            
            <div className="space-y-5">
              {venues.length === 0 ? (
                <div className="text-center text-gray-400 py-6 text-sm border-2 border-dashed border-gray-100 rounded-2xl">目前還沒有設定任何場地喔！</div>
              ) : (
                venues.map((venue, idx) => {
                  const blocks = getSummaryBlocks(venue);
                  const { min, max } = getPriceExtremes(venue);

                  return (
                    <div key={venue.id} className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm relative group">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <div className="font-bold text-gray-800 text-lg">{venue.name}</div>
                            <div className="flex space-x-1">
                              {venue.mapUrl && <a href={venue.mapUrl} target="_blank" rel="noreferrer" className="w-7 h-7 bg-gray-50 border border-gray-100 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shadow-sm text-xs" title="查看地圖">🗺️</a>}
                              {venue.bookingUrl && <a href={venue.bookingUrl} target="_blank" rel="noreferrer" className="w-7 h-7 bg-gray-50 border border-gray-100 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shadow-sm text-xs" title="前往預約官網">🔗</a>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {venue.courtNames?.map((c: string) => <span key={c} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shadow-sm">{c}</span>)}
                          </div>
                        </div>
                        <div className="flex space-x-1.5 shrink-0 ml-2">
                          {/* ✨ 新增：往上移按鈕 (第一名不顯示) */}
                          {idx > 0 && (
                            <button onClick={() => handleMoveVenue(idx, 'up')} className="w-7 h-7 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 shadow-sm active:scale-95 transition-transform" title="往上移">
                              🔼
                            </button>
                          )}
                          
                          {/* ✨ 新增：往下移按鈕 (最後一名不顯示) */}
                          {idx < venues.length - 1 && (
                            <button onClick={() => handleMoveVenue(idx, 'down')} className="w-7 h-7 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 shadow-sm active:scale-95 transition-transform" title="往下移">
                              🔽
                            </button>
                          )}

                          <button onClick={() => openEditModal(venue)} className="w-7 h-7 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 shadow-sm active:scale-95">✏️</button>
                          <button onClick={() => handleDelete(venue.id)} className="w-7 h-7 bg-red-50 border border-red-100 rounded-lg flex items-center justify-center text-red-500 shadow-sm active:scale-95">🗑️</button>
                        </div>
                      </div>
                      
                      <div className="rounded-xl border border-gray-200 overflow-hidden text-xs">
                        <div className="flex bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                          <div className="w-[28%] py-2 text-center border-r border-gray-200">時段</div>
                          <div className="flex-1 py-2 text-center border-r border-gray-200 text-blue-700">平日</div>
                          <div className="flex-1 py-2 text-center border-r border-gray-200 text-orange-600">週六</div>
                          <div className="flex-1 py-2 text-center text-red-600">週日</div>
                        </div>
                        {blocks.map((b, idx) => (
                          <div key={idx} className="flex border-b border-gray-100 last:border-0 bg-white">
                            <div className="w-[28%] py-2.5 text-center font-bold text-gray-600 border-r border-gray-100 flex items-center justify-center">{b.start}-{b.end}</div>
                            <div className={`flex-1 py-2.5 text-center border-r border-gray-100 flex items-center justify-center ${getHeatmapClass(b.wDay.isOpen, b.wDay.price, min, max)}`}>{b.wDay.isOpen ? `$${b.wDay.price}` : '❌'}</div>
                            <div className={`flex-1 py-2.5 text-center border-r border-gray-100 flex items-center justify-center ${getHeatmapClass(b.sat.isOpen, b.sat.price, min, max)}`}>{b.sat.isOpen ? `$${b.sat.price}` : '❌'}</div>
                            <div className={`flex-1 py-2.5 text-center flex items-center justify-center ${getHeatmapClass(b.sun.isOpen, b.sun.price, min, max)}`}>{b.sun.isOpen ? `$${b.sun.price}` : '❌'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

{/* === ✨ 成員管理頁籤 === */}
{adminTab === 'users' && (
          <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-gray-800 font-bold flex items-center text-base"><span className="text-blue-500 mr-2 text-xl">👥</span> 群組成員清單</h3>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">共 {allUsers.length} 人</span>
            </div>

            <div className="space-y-3">
              {allUsers.length === 0 ? (
                <div className="text-center text-gray-400 py-6 text-sm border-2 border-dashed border-gray-100 rounded-2xl">尚無任何成員資料</div>
              ) : (
                allUsers.map((user) => (
                  <div key={user.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-xl bg-gray-50/50 shadow-sm">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${user.color || 'bg-blue-100'}`}>
                        {user.avatar}
                      </div>
                      <div className="flex flex-col truncate pr-2">
                        <span className="font-bold text-gray-800 text-sm truncate">{user.name}</span>
                        {user.paymentInfo ? (
                          <span className="text-[10px] text-emerald-600 font-bold truncate">🏦 已設定收款</span>
                        ) : (
                          <span className="text-[10px] text-gray-400 truncate">未設定收款資訊</span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteUser(user.id, user.name)}
                      className="w-8 h-8 shrink-0 bg-white border border-red-100 rounded-lg flex items-center justify-center text-red-500 shadow-sm active:scale-95 transition-transform"
                      title="刪除此成員"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>

                        {/* ✨ 新增：手動清理殘留幽靈紀錄的按鈕 */}
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="text-xs font-bold text-amber-800 mb-1">🧹 系統維護工具</div>
              <p className="text-[11px] text-amber-700 mb-3">如果之前刪除成員時有殘留紀錄在日曆上，可以點擊下方按鈕自動清除所有「不存在的用戶」的報名。</p>
              <button 
                onClick={async () => {
                  if (confirm('確定要掃描並清除所有日曆中的幽靈報名紀錄嗎？')) {
                    const eventsSnapshot = await getDocs(collection(db, 'events'));
                    const validUserIds = new Set(allUsers.map(u => u.id));
                    let cleanedCount = 0;

                    const promises: Promise<void>[] = [];
                    eventsSnapshot.forEach(eventDoc => {
                      const data = eventDoc.data();
                      const players = data.players || [];
                      // 過濾掉不屬於現存 validUserIds 的球員
                      const filteredPlayers = players.filter((p: any) => validUserIds.has(p.id));

                      if (filteredPlayers.length !== players.length) {
                        cleanedCount++;
                        let newIsBooked = data.isBooked;
                        let newHost = data.host;
                        let newTimeInfo = data.timeInfo;
                        let newHostCourtsInfo = data.hostCourtsInfo;
                        let newTotalPrice = data.totalPrice;
                        let newVenue = data.venue;

                        // 如果主揪剛好是被刪除的人，順便拔除主揪資格
                        if (data.host && !validUserIds.has(data.host.id)) {
                          newIsBooked = false;
                          newHost = null;
                          newTimeInfo = null;
                          newHostCourtsInfo = [];
                          newTotalPrice = 0;
                          newVenue = null;
                        }

                        // 如果過濾後沒人了，順便重置
                        if (filteredPlayers.length === 0) {
                          newIsBooked = false;
                          newHost = null;
                          newTimeInfo = null;
                          newHostCourtsInfo = [];
                          newTotalPrice = 0;
                          newVenue = null;
                        }

                        promises.push(
                          updateDoc(doc(db, 'events', eventDoc.id), {
                            players: filteredPlayers,
                            isBooked: newIsBooked,
                            host: newHost,
                            timeInfo: newTimeInfo,
                            hostCourtsInfo: newHostCourtsInfo,
                            totalPrice: newTotalPrice,
                            venue: newVenue
                          })
                        );
                      }
                    });

                    await Promise.all(promises);
                    alert(`清理完成！已自動修正 ${cleanedCount} 個日曆活動的殘留紀錄。`);
                  }
                }}
                className="w-full py-2.5 bg-amber-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-transform"
              >
                🧹 一鍵清除所有殘留的幽靈報名紀錄
              </button>
            </div>

          </div>
        )}

      </div>

      {/* 場地編輯 Modal (保持不變) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center items-end bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md h-[95vh] bg-white rounded-t-[2.5rem] shadow-2xl flex flex-col relative animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-center pt-4 pb-2 relative shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
              <button onClick={() => setIsModalOpen(false)} className="absolute right-6 top-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-48">
              <h3 className="text-2xl font-bold text-gray-800 tracking-tight mb-6 mt-2">{editingId ? '編輯場地資訊' : '新增場地費率'}</h3>
              <div className="space-y-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">場地名稱 (必填)</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例: 竹北運動公園" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 font-bold focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div className="flex space-x-3">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">🗺️ 地圖導航網址</label>
                      <input type="url" value={mapUrl} onChange={e => setMapUrl(e.target.value)} placeholder="https://maps..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 font-bold focus:outline-none focus:border-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">🔗 官方預約網址</label>
                      <input type="url" value={bookingUrl} onChange={e => setBookingUrl(e.target.value)} placeholder="https://..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 font-bold focus:outline-none focus:border-emerald-400" />
                    </div>
                  </div>
                  {/* ✨ 新增：備註欄位 */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">📝 場地備註資訊</label>
                    <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="例: 停車場在後門、需先到櫃台換證" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 font-bold focus:outline-none focus:border-emerald-400" />
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <label className="block text-xs font-bold text-gray-500 mb-2">場地選項 (至少新增一個)</label>
                  <div className="flex space-x-2 mb-3"><input type="text" value={newCourtInput} onChange={e => setNewCourtInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddCourt()} placeholder="輸入名稱(例:A場)" className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" /><button onClick={handleAddCourt} className="bg-gray-800 text-white font-bold px-4 py-2 rounded-lg text-sm active:scale-95">加入</button></div>
                  <div className="flex flex-wrap gap-2">{courtNames.map(court => (<div key={court} className="flex items-center bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm">{court} <button onClick={() => handleRemoveCourt(court)} className="ml-2 text-emerald-300 hover:text-emerald-500">✕</button></div>))}</div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-emerald-700 mb-3 flex items-center"><span className="mr-1">🕒</span> 24小時費率選取面板</label>
                  <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md pt-2 pb-4 border-b border-gray-100 mb-2 space-y-3">
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-500">已選取 <span className="text-emerald-600 text-base">{selectedHours.length}</span> 時段</span><div className="flex space-x-1"><button onClick={selectDaytime} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded">白天 06-16</button><button onClick={selectNight} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded">晚上 17-23</button><button onClick={selectAll} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded">全選</button><button onClick={clearSelection} className="text-[10px] bg-red-50 text-red-500 px-2 py-1 rounded">清除</button></div></div>
                    <div className="flex items-center space-x-1.5">
                      <div className="relative w-[28%] shrink-0"><span className="absolute left-2 top-2 text-gray-400 font-bold text-xs">$</span><input type="number" value={batchPrice} onChange={e => setBatchPrice(e.target.value ? Number(e.target.value) : '')} placeholder="金額" className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-6 pr-1 py-2 text-sm font-bold focus:outline-none focus:border-emerald-400" /></div>
                      <button onClick={() => applyPricing('weekday')} className="flex-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold py-2.5 rounded-lg active:scale-95">平日</button>
                      <button onClick={() => applyPricing('saturday')} className="flex-1 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold py-2.5 rounded-lg active:scale-95">週六</button>
                      <button onClick={() => applyPricing('sunday')} className="flex-1 bg-red-50 text-red-700 border border-red-200 text-xs font-bold py-2.5 rounded-lg active:scale-95">週日</button>
                      <button onClick={() => applyPricing('closed')} className="w-9 bg-gray-100 text-gray-400 text-xs font-bold py-2.5 rounded-lg active:scale-95 border border-gray-200 shrink-0">✕</button>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white text-xs">
                    <div className="flex bg-gray-100 border-b border-gray-200 font-bold text-gray-500"><div className="w-[20%] py-2 text-center border-r border-gray-200">時間</div><div className="flex-1 py-2 text-center text-blue-700 border-r border-gray-200">平日</div><div className="flex-1 py-2 text-center text-orange-600 border-r border-gray-200">週六</div><div className="flex-1 py-2 text-center text-red-600">週日</div></div>
                    {Array.from({length: 24}).map((_, i) => {
                      const isSelected = selectedHours.includes(i); const wDay = weekdayPricing[i]; const sat = saturdayPricing[i]; const sun = sundayPricing[i];
                      return (
                        <div key={i} onClick={() => toggleHourSelection(i)} className={`flex border-b border-gray-100 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/70' : 'bg-white hover:bg-gray-50'}`}>
                          <div className={`w-[20%] py-2.5 text-center font-bold border-r border-gray-100 flex items-center justify-center space-x-1 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>{isSelected && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>}<span>{i}</span></div>
                          <div className={`flex-1 py-2.5 text-center border-r border-gray-100 font-bold ${wDay.isOpen ? 'text-gray-700' : 'text-gray-300'}`}>{wDay.isOpen ? `$${wDay.price}` : '❌'}</div>
                          <div className={`flex-1 py-2.5 text-center border-r border-gray-100 font-bold ${sat.isOpen ? 'text-gray-700' : 'text-gray-300'}`}>{sat.isOpen ? `$${sat.price}` : '❌'}</div>
                          <div className={`flex-1 py-2.5 text-center font-bold ${sun.isOpen ? 'text-gray-700' : 'text-gray-300'}`}>{sun.isOpen ? `$${sun.price}` : '❌'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-white via-white to-transparent">
              <button onClick={handleSave} className="w-full py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-600 active:scale-95 transition-transform text-lg">💾 儲存並產生課表</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}