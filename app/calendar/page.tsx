"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const ANIMAL_OPTIONS = [
  // 🐾 動物與海洋世界
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', 
  '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦆', '🦉', '🦄', 
  '🐑', '🐐', '🦖', '🐙', '🦋', '🐢', '🐬', '🐳', '🦥', '🦦',
  
  // 😎 酷炫人物與奇幻角色
  '😎', '🥸', '🤠', '🥳', '🤡', '🥷', '🦸', '🧙', '🧚', '🧛', 
  '🧜', '👼', '👻', '👽', '🤖', '💂', '🕵️', '🧑‍🚀', '🧑‍🍳', '🧑‍🎤',
  
  // 🃏 撲克、棋盤與休閒娛樂 (新加入！)
  '🃏', '♠️', '♥️', '♦️', '♣️', '🀄', '♟️', '🎲', '🎰', '🧩', '🎯',
  
  // 🎻 樂器與影音
  '🎻', '🎸', '🎹', '🥁', '🎺', '🎧', '🎨', '🎮', '🎬',
  
  // 🍞 烘焙與吃貨必備
  '🍞', '🥐', '🥖', '🥪', '🥨', '🥯', '🥞', '🍕', '🍔', '🍟', 
  '🌮', '🍣', '🍜', '🍩', '🍪', '🍎', '🍉', '🍓', '🥑', '🥦',
  
  // ☕ 飲料與乾杯
  '🍦', '🍧', '☕', '🧋', '🍺', '🍻', '🍷', '🍹',
  
  // 🎾 運動健將
  '🎾', '🏸', '🏀', '⚽', '⚾', '🏐', '🎱', '🏓', '🎳', '🥊', '🏂',
  
  // 🌟 宇宙、大自然與尊榮標誌
  '🌟', '🔥', '🚀', '🛸', '🌈', '🍀', '🌻', '🌲', '👑', '💎', '⚡', '🌙'
];

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getEmptyDayPricing = () => Array(24).fill({ isOpen: false, price: 0 });

export default function CalendarPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'settings' | 'ledger'>('settings');
  const [editAvatar, setEditAvatar] = useState('');
  const [editPaymentInfo, setEditPaymentInfo] = useState('');
  const [editName, setEditName] = useState('');
  // ✨ 1. 新增多天報名狀態
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [multiSelectedDates, setMultiSelectedDates] = useState<string[]>([]);
  const [multiSelectCount, setMultiSelectCount] = useState(1);

  // ✨ 2. 多天報名的送出函式 (放在 handleBecomeHost 的上方或附近即可)
  const handleMultiSubmit = async () => {
    if (multiSelectedDates.length === 0) return;
    const updatePromises = multiSelectedDates.map(dateStr => {
      const docRef = doc(db, 'events', dateStr);
      const eventData = monthData[dateStr] || { players: [] };
      
      // 濾掉自己舊的紀錄，換上新的人數
      const updatedPlayers = eventData.players.filter((p: any) => p.id !== currentUser.id);
      updatedPlayers.push({ ...currentFullUser, count: multiSelectCount, hasPaid: false });
      
      return setDoc(docRef, { players: updatedPlayers }, { merge: true });
    });

    await Promise.all(updatePromises);
    alert(`✅ 成功報名了 ${multiSelectedDates.length} 個場次！`);
    setIsMultiSelectMode(false);
    setMultiSelectedDates([]);
    setMultiSelectCount(1);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('pickleball_user');
    if (storedUser) setCurrentUser(JSON.parse(storedUser));
  }, []);

  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0); 
  
  const [viewYear, setViewYear] = useState(todayObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayObj.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [monthData, setMonthData] = useState<Record<string, any>>({});
  
  const [venues, setVenues] = useState<any[]>([]);
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);

  const [isSettingHost, setIsSettingHost] = useState(false);
  const [hostVenue, setHostVenue] = useState('');
  const [hostCourtsInfo, setHostCourtsInfo] = useState<{name: string, start: number, end: number}[]>([]);
  const [hostPrice, setHostPrice] = useState(0);

  const getCalendarGrid = () => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startDayOfWeek = firstDay.getDay(); 
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const grid = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) grid.push({ dateObj: new Date(viewYear, viewMonth - 1, daysInPrevMonth - i), isCurrentMonth: false });
    for (let i = 1; i <= daysInMonth; i++) grid.push({ dateObj: new Date(viewYear, viewMonth, i), isCurrentMonth: true });
    const totalCells = Math.ceil(grid.length / 7) * 7;
    const remainingCells = totalCells - grid.length;
    for (let i = 1; i <= remainingCells; i++) grid.push({ dateObj: new Date(viewYear, viewMonth + 1, i), isCurrentMonth: false });
    return grid;
  };
  const calendarGrid = getCalendarGrid();

  const handlePrevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else { setViewMonth(viewMonth - 1); } };
  const handleNextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else { setViewMonth(viewMonth + 1); } };

  useEffect(() => {
    const unsubEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      const newData: Record<string, any> = {};
      snapshot.forEach(doc => { newData[doc.id] = doc.data(); });
      setMonthData(newData);
    });
    const unsubVenues = onSnapshot(collection(db, 'venues'), (snapshot) => {
      const loadedVenues: any[] = [];
      snapshot.forEach((doc) => { loadedVenues.push({ id: doc.id, ...doc.data() }); });
      setVenues(loadedVenues);
      if (loadedVenues.length > 0 && !hostVenue) setHostVenue(loadedVenues[0].id);
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const loadedUsers: any[] = [];
      snapshot.forEach(doc => loadedUsers.push({ id: doc.id, ...doc.data() }));
      setAllUsers(loadedUsers);
    });

    return () => { unsubEvents(); unsubVenues(); unsubUsers(); };
  }, [hostVenue]);

  // ✨ 精準計價引擎：支援跨夜加總
  useEffect(() => {
    const venue = venues.find(v => v.id === hostVenue);
    if (venue && selectedDateStr && hostCourtsInfo.length > 0) {
      const dayOfWeek = new Date(selectedDateStr).getDay(); 
      let pricingArray = venue.weekdayPricing || getEmptyDayPricing();
      if (dayOfWeek === 6) pricingArray = venue.saturdayPricing || venue.weekendPricing || getEmptyDayPricing();
      if (dayOfWeek === 0) pricingArray = venue.sundayPricing || venue.weekendPricing || getEmptyDayPricing();

      let total = 0;
      hostCourtsInfo.forEach(court => {
        let currentHour = court.start;
        // 💡 使用 while 迴圈，如果是 23 到 1，會依序跑 23 -> 0，然後在 1 停下
        while (currentHour !== court.end) {
          if (pricingArray[currentHour] && pricingArray[currentHour].isOpen) {
            total += pricingArray[currentHour].price;
          }
          currentHour = (currentHour + 1) % 24;
        }
      });
      setHostPrice(total);
    } else {
      setHostPrice(0);
    }
  }, [hostVenue, hostCourtsInfo, venues, selectedDateStr]);

  if (!currentUser) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">載入中...</div>;

  const currentFullUser = allUsers.find(u => u.id === currentUser.id) || currentUser;

  const selectedDayData = selectedDateStr ? (monthData[selectedDateStr] || { players: [] }) : { players: [] };
  const hasSignedUpSelected = selectedDayData.players.some((user: any) => user.id === currentUser.id);
  const isPastSelected = selectedDateStr ? new Date(selectedDateStr) < todayObj : false;
  const selectedTotalPlayers = selectedDayData.players.reduce((sum: number, p: any) => sum + (p.count || 1), 0);
  const myRecord = selectedDayData.players.find((p: any) => p.id === currentUser.id);
  const myCount = myRecord ? (myRecord.count || 1) : 0;
  
  const selectedDateObj = selectedDateStr ? new Date(selectedDateStr) : new Date();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const timeOptions = Array.from({length: 24}, (_, i) => i);

  const handleSignup = async (count: number) => {
    if (!selectedDateStr) return;
    const docRef = doc(db, 'events', selectedDateStr);
    const updatedPlayers = selectedDayData.players.filter((p: any) => p.id !== currentUser.id);
    updatedPlayers.push({ ...currentFullUser, count, hasPaid: false });
    await setDoc(docRef, { players: updatedPlayers }, { merge: true });
  };

  const handleCancel = async () => {
    if (!selectedDateStr) return;
    const docRef = doc(db, 'events', selectedDateStr);
    const updatedPlayers = selectedDayData.players.filter((p: any) => p.id !== currentUser.id);
    if (updatedPlayers.length === 0) await setDoc(docRef, { players: updatedPlayers, isBooked: false, host: null }, { merge: true });
    else await setDoc(docRef, { players: updatedPlayers }, { merge: true });
  };

  const handleMinus = () => { if (myCount <= 1) handleCancel(); else handleSignup(myCount - 1); };
  const handlePlus = () => { handleSignup(myCount + 1); };

  const handleTogglePayment = async (dateStr: string, playerId: string, currentPaidStatus: boolean) => {
    if (!dateStr) return;
    const docRef = doc(db, 'events', dateStr);
    const event = monthData[dateStr];
    if (!event) return;

    const updatedPlayers = event.players.map((p: any) => 
      p.id === playerId ? { ...p, hasPaid: !currentPaidStatus } : p
    );
    await setDoc(docRef, { players: updatedPlayers }, { merge: true });
  };

  const handleCourtToggle = (courtName: string) => {
    setHostCourtsInfo(prev => {
      const exists = prev.find(c => c.name === courtName);
      if (exists) return prev.filter(c => c.name !== courtName);
      return [...prev, { name: courtName, start: 14, end: 16 }].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleCourtTimeChange = (courtName: string, field: 'start' | 'end', value: number) => {
    setHostCourtsInfo(prev => prev.map(c => {
      if (c.name === courtName) {
        const newCourt = { ...c, [field]: value };
        // 💡 如果他不小心把開始跟結束選成同一個時間，自動幫他往後延 1 小時
        if (newCourt.start === newCourt.end) {
          newCourt.end = (newCourt.start + 1) % 24;
        }
        return newCourt;
      }
      return c;
    }));
  };

  const handleBecomeHost = async () => {
    if (!selectedDateStr) return;
    if (hostCourtsInfo.length === 0) return alert('請至少選擇一個場地！');
    const docRef = doc(db, 'events', selectedDateStr);
    const selectedVenueData = venues.find(v => v.id === hostVenue);
    const minStart = hostCourtsInfo[0].start;
    const maxEnd = hostCourtsInfo[0].end;

    await setDoc(docRef, { 
      isBooked: true, 
      host: currentFullUser, 
      timeInfo: { start: minStart, end: maxEnd, hours: maxEnd - minStart },
      hostCourtsInfo: hostCourtsInfo,
      totalPrice: hostPrice,
      venue: selectedVenueData
    }, { merge: true });
    setIsSettingHost(false);
  };

  const openEditHost = () => {
    setHostVenue(selectedDayData.venue?.id || venues[0]?.id || '');
    if (selectedDayData.hostCourtsInfo) setHostCourtsInfo(selectedDayData.hostCourtsInfo);
    else setHostCourtsInfo((selectedDayData.selectedCourts || []).map((c: string) => ({ name: c, start: selectedDayData.timeInfo?.start || 14, end: selectedDayData.timeInfo?.end || 16 })));
    setIsSettingHost(true);
  };

  const handleCancelHost = async () => {
    if (!selectedDateStr) return;
    if (!confirm('確定要取消訂場嗎？系統將恢復為「揪團中」狀態。')) return;
    const docRef = doc(db, 'events', selectedDateStr);
    await setDoc(docRef, { isBooked: false, host: null, timeInfo: null, hostCourtsInfo: [], totalPrice: 0, venue: null }, { merge: true });
    setIsSettingHost(false);
  };

  const openProfile = () => {
    setEditName(currentFullUser.name);
    setEditAvatar(currentFullUser.avatar);
    setEditPaymentInfo(currentFullUser.paymentInfo || '');
    setIsProfileOpen(true);
  };

  // ✨ 替換整段 handleSaveProfile
  const handleSaveProfile = async () => {
    if (!editName.trim()) return alert('暱稱不能為空！');
    if (!editAvatar) return alert('請選擇一個頭像！');

    const newName = editName.trim();
    const userRef = doc(db, 'users', currentUser.id);
    await setDoc(userRef, { name: newName, avatar: editAvatar, paymentInfo: editPaymentInfo }, { merge: true });
    
    // 更新本地端資料
    const updatedUser = { ...currentUser, name: newName, avatar: editAvatar, paymentInfo: editPaymentInfo };
    setCurrentUser(updatedUser);
    localStorage.setItem('pickleball_user', JSON.stringify(updatedUser));

    // 💡 自動清道夫：連帶更新「未來日曆」上的名字與頭像
    const eventsSnapshot = await getDocs(collection(db, 'events'));
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    const updatePromises: Promise<void>[] = [];
    eventsSnapshot.forEach((eventDoc) => {
      const eventDateObj = new Date(eventDoc.id);
      if (eventDateObj >= todayObj) {
        const eventData = eventDoc.data();
        let needsUpdate = false;
        let newPlayers = eventData.players || [];
        let newHost = eventData.host;

        if (newHost?.id === currentUser.id) {
          newHost = { ...newHost, name: newName, avatar: editAvatar, paymentInfo: editPaymentInfo };
          needsUpdate = true;
        }
        if (newPlayers.some((p: any) => p.id === currentUser.id)) {
          newPlayers = newPlayers.map((p: any) => p.id === currentUser.id ? { ...p, name: newName, avatar: editAvatar } : p);
          needsUpdate = true;
        }
        if (needsUpdate) {
          updatePromises.push(updateDoc(doc(db, 'events', eventDoc.id), { players: newPlayers, host: newHost }));
        }
      }
    });

    await Promise.all(updatePromises);
    alert('儲存成功！你的暱稱與資料已全面更新！');
  };

  const jumpToDate = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    setViewYear(dateObj.getFullYear());
    setViewMonth(dateObj.getMonth());
    setSelectedDateStr(dateStr);
    setIsProfileOpen(false);
  };

  const usedAvatars = allUsers.map(u => u.avatar).filter(a => a !== currentFullUser.avatar);
  const availableAvatars = ANIMAL_OPTIONS.filter(a => !usedAvatars.includes(a));

  const myHostedDates = Object.keys(monthData)
    .filter(date => monthData[date].isBooked && monthData[date].host?.id === currentUser.id)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const ongoingLedgers: any[] = [];
  const completedLedgers: any[] = [];

  myHostedDates.forEach(date => {
    const event = monthData[date];
    const totalPlayersCount = event.players.reduce((sum: number, p: any) => sum + (p.count || 1), 0);
    const pricePerPerson = Math.ceil(event.totalPrice / (totalPlayersCount || 1));

    const paidPlayers = event.players.filter((p: any) => p.hasPaid || p.id === currentUser.id);
    const otherPlayers = event.players.filter((p: any) => p.id !== currentUser.id);
    
    const totalCollected = paidPlayers.reduce((sum: number, p: any) => sum + (p.count || 1) * pricePerPerson, 0);
    const isCompleted = otherPlayers.length > 0 && otherPlayers.every((p: any) => p.hasPaid);

    const ledgerItem = { date, event, totalPlayersCount, pricePerPerson, totalCollected, otherPlayers, isCompleted };
    if (isCompleted) completedLedgers.push(ledgerItem);
    else ongoingLedgers.push(ledgerItem);
  });

  // 場地課表的輔助函式
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
  // --- ✨ 新增：剪貼簿與罐頭訊息產生器 ---
  const handleCopyText = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('📋 已成功複製到剪貼簿！可以去 LINE 貼上了！'))
        .catch(() => alert('複製失敗，請確認瀏覽器權限。'));
    } else {
      alert('您的瀏覽器不支援一鍵複製，請手動圈選複製。');
    }
  };

  const getReminderMsg = (dateStr: string, event: any) => {
    const courts = event.hostCourtsInfo?.map((c:any) => `${c.name}(${c.start}:00-${c.end}:00)`).join(', ') || '未指定';
    const players = event.players.map((p:any) => `${p.name}${p.count > 1 ? `(+${p.count - 1})` : ''}`).join(', ');
    const totalPlayers = event.players.reduce((sum:number, p:any) => sum + (p.count || 1), 0);
    return `📢 【打球提醒】\n📅 日期：${dateStr}\n📍 地點：${event.venue?.name}\n🎾 場地：${courts}\n👥 名單 (${totalPlayers}人)：${players}\n\n⚠️ 請大家記得帶水與毛巾，準時到場喔！`;
  };

  const getPaymentMsg = (dateStr: string, event: any) => {
    const hostLiveInfo = allUsers.find(u => u.id === event.host?.id);
    const paymentInfo = hostLiveInfo?.paymentInfo || '主揪尚未設定收款帳號';
    const totalPlayersCount = event.players.reduce((sum: number, p: any) => sum + (p.count || 1), 0);
    const pricePerPerson = Math.ceil(event.totalPrice / (totalPlayersCount || 1));
    const unpaidPlayers = event.players.filter((p: any) => !p.hasPaid && p.id !== event.host?.id);
    
    if (unpaidPlayers.length === 0) return `🎉 【場地費結算】\n${dateStr} 於 ${event.venue?.name} 的場地費，大家都已經付清囉！感謝配合！`;
    
    const unpaidList = unpaidPlayers.map((p:any) => `- ${p.name}: $${(p.count || 1) * pricePerPerson}`).join('\n');
    return `💰 【場地費結算】\n📅 日期：${dateStr}\n📍 地點：${event.venue?.name}\n💵 每人分攤：$${pricePerPerson}\n\n🏦 匯款資訊：\n${paymentInfo}\n\n👀 尚未付款名單：\n${unpaidList}\n\n✅ 匯款後請去系統點擊「已付清」，或在群組說一聲喔！`;
  };
  // ------------------------------------
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4 font-sans relative overflow-hidden">
      
      {/* 頂部導覽列 */}
      <div className="w-full max-w-md flex justify-between items-center mb-6 px-2">
        <Link href="/" className="text-gray-400 text-sm hover:text-gray-600 transition-colors">◀ 返回</Link>
        <div className="flex items-center space-x-4">
          <button onClick={handlePrevMonth} className="p-2 text-gray-400 hover:text-gray-700 active:scale-90 transition-transform">◀</button>
          <h2 className="text-xl font-bold text-gray-800 tracking-wide">{viewYear} 年 {viewMonth + 1} 月</h2>
          <button onClick={handleNextMonth} className="p-2 text-gray-400 hover:text-gray-700 active:scale-90 transition-transform">▶</button>
        </div>
        <div className="flex items-center space-x-3">
          <Link href="/admin" className="text-xl opacity-50 hover:opacity-100 transition-opacity">⚙️</Link>
          <button onClick={openProfile} className={`w-9 h-9 rounded-full flex items-center justify-center text-base shadow-sm border-2 border-white hover:scale-105 active:scale-95 transition-transform ${currentFullUser.color}`}>
            {currentFullUser.avatar}
          </button>
        </div>
      </div>

      {/* 日曆主體 */}
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-sm p-5 border border-gray-100 relative">

        {/* 下方原本的星期排列維持不動 */}
        <div className="grid grid-cols-7 gap-2 mb-4 text-center">
          {weekDays.map((day, idx) => <div key={day} className={`text-xs font-bold ${idx === 0 || idx === 6 ? 'text-orange-400' : 'text-gray-400'}`}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarGrid.map((dayItem, idx) => {
            const dateStr = formatDate(dayItem.dateObj);
            const isWeekend = dayItem.dateObj.getDay() === 0 || dayItem.dateObj.getDay() === 6;
            const isToday = dateStr === formatDate(todayObj);
            const isPast = dayItem.dateObj < todayObj;
            
            const dayData = monthData[dateStr] || { players: [] };
            const totalPlayers = dayData.players?.reduce((sum: number, p: any) => sum + (p.count || 1), 0) || 0;
            const hasSignedUp = dayData.players?.some((p: any) => p.id === currentUser.id);
            const isBooked = dayData.isBooked || false;
// ✨ 記得在 return 前面加上這行，判斷這天有沒有被勾選
            const isMultiSelected = multiSelectedDates.includes(dateStr);

            return (
              <button 
                key={idx} 
                onClick={() => {
                  // ✨ 如果在多選模式下：
                  if (isMultiSelectMode) {
                    if (isPast) return; // 過去的日子不能選
                    if (multiSelectedDates.includes(dateStr)) {
                      setMultiSelectedDates(prev => prev.filter(d => d !== dateStr)); // 取消打勾
                    } else {
                      setMultiSelectedDates(prev => [...prev, dateStr]); // 打勾
                    }
                  } 
                  // 正常模式下：
                  else {
                    setSelectedDateStr(dateStr); setIsSettingHost(false); 
                  }
                }}
                className={`
                  relative h-24 rounded-xl flex flex-col items-center py-1.5 transition-all overflow-hidden cursor-pointer active:scale-95
                  ${!isMultiSelectMode ? 'hover:bg-gray-100' : ''}
                  ${!isWeekend && !hasSignedUp ? 'bg-gray-50' : ''}
                  ${isWeekend && !hasSignedUp ? 'bg-gray-50' : ''}
                  ${hasSignedUp && !isMultiSelectMode ? 'bg-blue-50/50' : ''}
                  ${isPast ? 'opacity-60 grayscale' : ''}
                  ${isMultiSelectMode && isMultiSelected ? 'bg-blue-100 border-2 border-blue-500 shadow-inner' : 'border-2 border-transparent'}
                `}
              >
                {/* ✨ 多選模式的打勾符號 */}
                {isMultiSelectMode && isMultiSelected && (
                  <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[12px] font-bold z-10 shadow-md">✓</div>
                )}

                {/* 1. 上方圓點與日期 (保留你原本的設定) */}
                <div className="flex items-center justify-center space-x-1 mb-1">
                  {isBooked && hasSignedUp && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
                  {isBooked && !hasSignedUp && <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>}
                  {!isBooked && hasSignedUp && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                  
                  <div className={`text-sm font-bold w-6 h-6 flex items-center justify-center ${isToday ? 'bg-blue-500 text-white rounded-full' : !dayItem.isCurrentMonth ? 'text-gray-300' : hasSignedUp ? 'text-blue-700' : 'text-gray-700'}`}>
                    {dayItem.dateObj.getDate()}
                  </div>
                </div>
                
                {/* 2. 全新排版：時間(大) ➔ 場地(中) ➔ 人數(小) (保留你原本的設定) */}
                <div className="flex flex-col items-center justify-center w-full space-y-1">
                  {isBooked && dayData.timeInfo?.start && (
                    <>
                      <span className="text-xs text-blue-700 font-extrabold tracking-tighter leading-none">
                        {dayData.timeInfo.start}-{dayData.timeInfo.end}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold whitespace-nowrap overflow-hidden leading-none">
                        {dayData.venue?.name?.substring(0, 3)}
                      </span>
                    </>
                  )}
                  
                  {/* 下方原本顯示人數的區塊維持不動 */}
                  {totalPlayers > 0 ? (
                    <span className={`text-[10px] font-bold leading-none flex items-center space-x-0.5 mt-0.5 ${hasSignedUp ? 'text-blue-700' : 'text-gray-500'}`}>
                      <span>👥</span><span>{totalPlayers}</span>
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ✨ 底部狀態區：平常顯示圖例，連續報名時切換成設定面板 */}
      <div className="w-full max-w-md mt-5 px-2">
        {!isMultiSelectMode ? (
          <div className="flex items-center justify-between">
            <div className="flex space-x-3 text-[10px] text-gray-500 font-medium">
              <span className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div> 已報名</span>
              <span className="flex items-center"><div className="w-2 h-2 bg-orange-400 rounded-full mr-1"></div> 已成團</span>
              <span className="flex items-center"><div className="w-2 h-2 bg-emerald-500 rounded-full mr-1"></div> 報名＋成團</span>
            </div>
            <button 
              onClick={() => setIsMultiSelectMode(true)} 
              className="text-sm bg-blue-50 text-blue-600 font-extrabold px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-transform border border-blue-200 flex items-center"
            >
              <span className="mr-1.5 text-lg">✅</span> 連續報名
            </button>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 animate-in slide-in-from-bottom-4 shadow-sm relative">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-blue-800">✅ 請點擊日曆勾選日期</span>
              <button onClick={() => { setIsMultiSelectMode(false); setMultiSelectedDates([]); }} className="text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-200 active:scale-95">取消退出</button>
            </div>
            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-blue-200 shadow-sm">
              <span className="text-sm text-gray-600 font-bold ml-2">本次報名人數</span>
              <div className="flex items-center space-x-4 bg-gray-50 rounded-xl p-1.5 border border-gray-100">
                <button onClick={() => setMultiSelectCount(prev => Math.max(1, prev - 1))} className="w-9 h-9 bg-white rounded-lg flex items-center justify-center font-bold text-gray-600 shadow-sm active:scale-95 text-lg">－</button>
                <span className="font-bold text-blue-700 w-6 text-center text-lg">{multiSelectCount}</span>
                <button onClick={() => setMultiSelectCount(prev => prev + 1)} className="w-9 h-9 bg-white rounded-lg flex items-center justify-center font-bold text-gray-600 shadow-sm active:scale-95 text-lg">＋</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- ✨ 下方新增：動態場地與課表資訊區塊 --- */}
      <div className="w-full max-w-md mt-8 space-y-4 pb-12">
        <h3 className="text-gray-800 font-bold flex items-center text-base px-2">
          <span className="text-emerald-500 mr-2 text-xl">🏟️</span> 常見場地資訊
        </h3>
        {venues.length === 0 ? (
          <div className="text-center text-gray-400 py-6 text-sm bg-white rounded-2xl shadow-sm border border-gray-100">載入中或尚無場地資料</div>
        ) : (
          venues.map(venue => {
            const isExpanded = expandedVenueId === venue.id;
            const blocks = getSummaryBlocks(venue);
            const { min, max } = getPriceExtremes(venue);

            return (
              <div key={venue.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 transition-all">
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedVenueId(isExpanded ? null : venue.id)}>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-800 text-sm">{venue.name}</span>
                    <div className="flex space-x-1" onClick={e => e.stopPropagation()}>
                      {venue.mapUrl && <a href={venue.mapUrl} target="_blank" rel="noreferrer" className="w-7 h-7 bg-gray-50 border border-gray-100 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shadow-sm text-xs" title="導航">🗺️</a>}
                      {venue.bookingUrl && <a href={venue.bookingUrl} target="_blank" rel="noreferrer" className="w-7 h-7 bg-gray-50 border border-gray-100 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shadow-sm text-xs" title="預約">🔗</a>}
                    </div>
                  </div>
                  <button className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform pointer-events-none">
                    {isExpanded ? '收起課表' : '查看課表'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2">
                    <div className="rounded-xl border border-gray-200 overflow-hidden text-xs">
                      <div className="flex bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                        <div className="w-[28%] py-2 text-center border-r border-gray-200">時段</div>
                        <div className="flex-1 py-2 text-center border-r border-gray-200 text-blue-700">平日</div>
                        <div className="flex-1 py-2 text-center border-r border-gray-200 text-orange-600">週六</div>
                        <div className="flex-1 py-2 text-center text-red-600">週日</div>
                      </div>
                      {blocks.map((b, idx) => (
                        <div key={idx} className="flex border-b border-gray-100 last:border-0 bg-white">
                          <div className="w-[28%] py-2.5 text-center font-bold text-gray-600 border-r border-gray-100 flex items-center justify-center">
                            {b.start}-{b.end}
                          </div>
                          <div className={`flex-1 py-2.5 text-center border-r border-gray-100 flex items-center justify-center ${getHeatmapClass(b.wDay.isOpen, b.wDay.price, min, max)}`}>
                            {b.wDay.isOpen ? `$${b.wDay.price}` : '❌'}
                          </div>
                          <div className={`flex-1 py-2.5 text-center border-r border-gray-100 flex items-center justify-center ${getHeatmapClass(b.sat.isOpen, b.sat.price, min, max)}`}>
                            {b.sat.isOpen ? `$${b.sat.price}` : '❌'}
                          </div>
                          <div className={`flex-1 py-2.5 text-center flex items-center justify-center ${getHeatmapClass(b.sun.isOpen, b.sun.price, min, max)}`}>
                            {b.sun.isOpen ? `$${b.sun.price}` : '❌'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {min !== max && min > 0 && (
                      <div className="flex justify-end space-x-3 mt-2 text-[10px]">
                        <span className="flex items-center"><span className="w-2 h-2 bg-emerald-300 rounded mr-1"></span>最低價</span>
                        <span className="flex items-center"><span className="w-2 h-2 bg-rose-300 rounded mr-1"></span>最高價</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* --- 日曆彈跳面板 --- */}
      {selectedDateStr && (
        <div className="fixed inset-0 z-50 flex justify-center items-end bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md h-[85vh] bg-white rounded-t-[2.5rem] shadow-2xl flex flex-col relative animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-center pt-4 pb-2 relative shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
              <button onClick={() => setSelectedDateStr(null)} className="absolute right-6 top-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-48">
              {/* ✨ 優化：將日期與狀態標籤放在同一行 */}
              {/* ✨ 優化：日期、狀態、與兩個提醒按鈕全部放在同一排 */}
              <div className="mb-4 mt-2 border-b border-gray-100 pb-4 flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-bold text-gray-800 tracking-tight shrink-0">
                  {selectedDateObj.getMonth() + 1}/{selectedDateObj.getDate()} ({weekDays[selectedDateObj.getDay()]})
                </h3>
                
                <div className="shrink-0">
                  {isPastSelected ? (
                    <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-bold rounded-full">⏳ 已結束</span>
                  ) : selectedDayData.isBooked ? (
                    hasSignedUpSelected ? (
                      <span className="inline-flex items-center px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full shadow-sm"><span className="mr-1">🎉</span> 報名＋成團</span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 bg-orange-100 text-orange-800 text-[11px] font-bold rounded-full shadow-sm"><span className="mr-1">🔥</span> 已成團</span>
                    )
                  ) : hasSignedUpSelected ? (
                    <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-full shadow-sm"><span className="mr-1">🙋‍♂️</span> 已報名</span>
                  ) : selectedTotalPlayers > 0 ? (
                    <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-bold rounded-full shadow-sm">💬 揪團中</span>
                  ) : null}
                </div>

                {/* 將複製按鈕移到這裡，與日期、狀態同排 */}
                {selectedDayData.isBooked && !isSettingHost && (
                  <div className="flex space-x-1.5 ml-auto">
                    <button onClick={() => handleCopyText(getReminderMsg(selectedDateStr, selectedDayData))} className="bg-white border border-emerald-300 text-emerald-700 text-[10px] font-bold px-2 py-1.5 rounded-lg active:scale-95 transition-transform shadow-sm flex items-center">
                      <span className="mr-1">⏰</span> 提醒
                    </button>
                    <button onClick={() => handleCopyText(getPaymentMsg(selectedDateStr, selectedDayData))} className="bg-white border border-emerald-300 text-emerald-700 text-[10px] font-bold px-2 py-1.5 rounded-lg active:scale-95 transition-transform shadow-sm flex items-center">
                      <span className="mr-1">💰</span> 討債
                    </button>
                  </div>
                )}
              </div>

              {selectedDayData.isBooked && selectedDayData.venue && !isSettingHost && (
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 mb-6 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-emerald-800 flex items-center"><span className="mr-2">👑</span> 本場主揪：{selectedDayData.host?.name}</span>
                    {selectedDayData.host?.id === currentUser.id && !isPastSelected && (
                      <button onClick={openEditHost} className="bg-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                        ✏️ 編輯
                      </button>
                    )}
                  </div>
                  <div className="h-[1px] bg-emerald-100 w-full"></div>
                  
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <span>📍</span>
                    <span className="font-bold text-base">{selectedDayData.venue.name}</span>
                    <div className="flex space-x-1 ml-1">
                      {selectedDayData.venue.mapUrl && <a href={selectedDayData.venue.mapUrl} target="_blank" rel="noreferrer" className="w-6 h-6 bg-white border border-emerald-200 flex items-center justify-center rounded-full hover:bg-emerald-50 transition-colors shadow-sm text-xs" title="導航">🗺️</a>}
                      {selectedDayData.venue.bookingUrl && <a href={selectedDayData.venue.bookingUrl} target="_blank" rel="noreferrer" className="w-6 h-6 bg-white border border-emerald-200 flex items-center justify-center rounded-full hover:bg-emerald-50 transition-colors shadow-sm text-xs" title="預約">🔗</a>}
                    </div>
                  </div>

                  <div className="bg-white/60 p-2 rounded-xl border border-emerald-100 space-y-1.5 mt-2">
                    {selectedDayData.hostCourtsInfo ? (
                      selectedDayData.hostCourtsInfo.map((c: any) => (
                        <div key={c.name} className="flex justify-between items-center text-sm px-2 py-1 bg-white rounded-lg shadow-sm border border-emerald-50">
                          <span className="font-bold text-emerald-700">🎾 {c.name}</span>
                          <span className="font-bold text-gray-700">{c.start}:00 - {c.end}:00</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">尚無詳細場地時間資料</span>
                    )}
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-emerald-50 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">總場地費</span>
                      <span className="font-bold text-gray-800">${selectedDayData.totalPrice || 0}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-500">目前預估每人分攤</span>
                      <span className="font-bold text-emerald-600 text-lg">${Math.ceil((selectedDayData.totalPrice || 0) / (selectedTotalPlayers || 1))}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-2 text-center">💡 實際收費可能因人數變動，請依主揪指示付款</div>
                  
                  {/* ---------------------------------- */}
                </div>
              )}

              {/* ✨ 隨時都可當主揪 */}
              {!selectedDayData.isBooked && !isPastSelected && !isSettingHost && (
                <div className="bg-orange-50 rounded-2xl p-5 mb-6 border border-orange-100 text-center shadow-sm">
                  <div className="text-orange-800 font-bold text-sm mb-3">🔔 目前尚無主揪，你要幫大家訂場地嗎？</div>
                  <button onClick={() => setIsSettingHost(true)} className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl shadow-sm hover:bg-orange-600 active:scale-95 transition-transform">
                    🙋‍♂️ 我已訂到場地 (成為主揪)
                  </button>
                </div>
              )}

              {isSettingHost && (
                <div className="bg-white border-2 border-orange-400 rounded-2xl p-4 mb-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-orange-600 text-sm flex items-center">👑 主揪設定場地</h4>
                    {selectedDayData.isBooked && selectedDayData.host?.id === currentUser.id && (
                      <button onClick={handleCancelHost} className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded-md">取消訂場</button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">選擇球場</label>
                      <select value={hostVenue} onChange={e => { setHostVenue(e.target.value); setHostCourtsInfo([]); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none">
                        {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">勾選場地</label>
                      <div className="flex flex-wrap gap-2">
                        {venues.find(v => v.id === hostVenue)?.courtNames?.map((courtName: string) => {
                          const isSelected = hostCourtsInfo.some(c => c.name === courtName);
                          return (
                            <label key={courtName} className={`flex items-center px-3 py-2 rounded-xl border text-sm cursor-pointer transition-colors select-none ${isSelected ? 'bg-orange-50 border-orange-400 text-orange-700 font-bold' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                              <input type="checkbox" className="hidden" checked={isSelected} onChange={() => handleCourtToggle(courtName)} />
                              {courtName}
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {hostCourtsInfo.length > 0 && (
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3">
                        <label className="block text-xs font-bold text-gray-500">個別設定時間</label>
                        {hostCourtsInfo.map(court => (
                          <div key={court.name} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                            <span className="font-bold text-sm text-gray-700">{court.name}</span>
                            <div className="flex items-center space-x-1">
                              <select value={court.start} onChange={e => handleCourtTimeChange(court.name, 'start', Number(e.target.value))} className="bg-gray-50 border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none">
                                {timeOptions.map(t => <option key={`start-${t}`} value={t}>{t}:00</option>)}
                              </select>
                              <span className="text-gray-400 text-xs">-</span>
                              <select value={court.end} onChange={e => handleCourtTimeChange(court.name, 'end', Number(e.target.value))} className="bg-gray-50 border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none">
                                {/* 💡 修改這裡：只禁止選「跟開始一樣」的時間，其他包含跨夜都可以選！ */}
                                {timeOptions.map(t => <option key={`end-${t}`} value={t} disabled={t === court.start}>{t}:00</option>)}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                      <label className="block text-xs font-bold text-orange-700 mb-1">場地總費用</label>
                      <div className="flex items-center">
                        <span className="text-orange-500 font-bold mr-2">$</span>
                        <input type="number" value={hostPrice} onChange={e => setHostPrice(Number(e.target.value))} className="w-full bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none" />
                      </div>
                    </div>
                    <div className="flex space-x-3 pt-2">
                      <button onClick={() => setIsSettingHost(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl active:scale-95">取消</button>
                      <button onClick={handleBecomeHost} className="flex-1 py-3 bg-orange-500 text-white text-sm font-bold rounded-xl shadow-md active:scale-95">確定發布</button>
                    </div>
                  </div>
                </div>
              )}

              {/* --- 報名名單與收款區塊 --- */}
              <div>
                <h4 className="text-sm font-bold text-gray-500 mb-4 flex justify-between">
                  <span>👥 報名名單 (共 {selectedTotalPlayers} 人)</span>
                </h4>
                
                <div className="space-y-3 mb-4">
                  {selectedDayData.players.map((user: any, idx: number) => {
                    const isHostEvent = selectedDayData.isBooked && selectedDayData.host?.id === currentUser.id;
                    const canTogglePayment = user.id === currentUser.id || isHostEvent;
                    const isThisUserHost = selectedDayData.isBooked && selectedDayData.host?.id === user.id;

                    return (
                      <div key={idx} className={`flex items-center justify-between bg-white border p-3 rounded-xl shadow-sm ${user.hasPaid || isThisUserHost ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'}`}>
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${user.color || 'bg-blue-100'}`}>{user.avatar}</div>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-700 text-sm">{user.name} {user.id === currentUser.id && '(你)'}</span>
                            <span className="text-xs font-bold text-blue-600 mt-0.5">+{user.count || 1} 人</span>
                          </div>
                        </div>
                        
                        {selectedDayData.isBooked && (
                          isThisUserHost ? (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-bold text-orange-500 bg-orange-50 border border-orange-100 shadow-sm">👑 主揪本人</span>
                          ) : (
                            <button 
                              onClick={() => canTogglePayment && handleTogglePayment(selectedDateStr, user.id, user.hasPaid)}
                              disabled={!canTogglePayment}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all ${
                                user.hasPaid 
                                  ? 'bg-emerald-500 text-white border border-emerald-600' 
                                  : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                              } ${!canTogglePayment ? 'cursor-not-allowed opacity-80' : 'active:scale-95'}`}
                            >
                              {user.hasPaid ? '✅ 已付清' : '❌ 未付款'}
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedDayData.isBooked && !isSettingHost && (
                  <div className="mt-6 mb-8">
                    {(() => {
                      const hostLiveInfo = allUsers.find(u => u.id === selectedDayData.host?.id);
                      if (hostLiveInfo?.paymentInfo) {
                        return (
                          <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-200 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                            <div className="text-xs font-bold text-emerald-700 mb-2 flex items-center pl-2">
                              <span className="mr-1.5 text-base">🏦</span> 主揪收款資訊
                            </div>
                            <div className="text-sm text-gray-800 whitespace-pre-wrap font-medium leading-relaxed pl-2">
                              {hostLiveInfo.paymentInfo}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 border-dashed text-center">
                            <div className="text-xs text-gray-400">主揪尚未設定收款資訊</div>
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
              <div className="pointer-events-auto">
                {isPastSelected ? (
                  <button disabled className="w-full py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl cursor-not-allowed shadow-sm border border-gray-200">活動已結束</button>
                ) : !hasSignedUpSelected ? (
                  <button onClick={() => handleSignup(1)} className="w-full py-4 bg-gray-800 text-white font-bold rounded-2xl shadow-lg hover:bg-gray-700 active:scale-95 transition-transform flex items-center justify-center space-x-2">
                    <span>✋ 我要報名</span>
                  </button>
                ) : (
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between space-x-3">
                      <button onClick={handleCancel} className="w-1/3 py-3.5 bg-red-50 text-red-600 font-bold rounded-2xl active:scale-95 transition-transform shadow-sm border border-red-100">取消報名</button>
                      <div className="w-2/3 flex items-center justify-between bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200">
                        <button onClick={handleMinus} className="w-12 h-10 bg-gray-50 rounded-xl text-xl font-bold active:scale-95 transition-transform text-gray-700 flex items-center justify-center hover:bg-gray-100">－</button>
                        <span className="font-bold text-gray-800 tracking-wide">{myCount} 人</span>
                        <button onClick={handlePlus} className="w-12 h-10 bg-gray-50 rounded-xl text-xl font-bold active:scale-95 transition-transform text-gray-700 flex items-center justify-center hover:bg-gray-100">＋</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 個人儀表板 --- */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">👑 個人儀表板</h3>
              <button onClick={() => setIsProfileOpen(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
            </div>

            <div className="flex px-6 pt-4 space-x-4 border-b border-gray-100">
              <button onClick={() => setProfileTab('settings')} className={`pb-3 font-bold text-sm transition-colors border-b-2 ${profileTab === 'settings' ? 'border-gray-800 text-gray-800' : 'border-transparent text-gray-400'}`}>個人設定</button>
              <button onClick={() => setProfileTab('ledger')} className={`pb-3 font-bold text-sm transition-colors border-b-2 ${profileTab === 'ledger' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400'}`}>我的對帳單</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {profileTab === 'settings' && (
                <div className="space-y-6">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <label className="block text-sm font-bold text-gray-700 mb-2">我的暱稱</label>
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      placeholder="輸入你的新暱稱"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 font-bold text-gray-800"
                    />
                  </div>
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <label className="block text-sm font-bold text-gray-700 mb-3">更換代表頭像</label>
                    <div className="grid grid-cols-5 gap-2 h-40 overflow-y-auto pr-2">
                      {availableAvatars.map(animal => (
                        <button key={animal} onClick={() => setEditAvatar(animal)} className={`text-2xl p-2 rounded-xl transition-all ${editAvatar === animal ? 'bg-blue-100 ring-2 ring-blue-400 scale-110' : 'bg-gray-50 hover:bg-gray-100'}`}>
                          {animal}
                        </button>
                      ))}
                      {usedAvatars.map(animal => (
                        <button key={`used-${animal}`} disabled className="text-2xl p-2 rounded-xl bg-gray-50 opacity-20 cursor-not-allowed grayscale">{animal}</button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <label className="block text-sm font-bold text-gray-700 mb-2">我的收款帳號</label>
                    <p className="text-xs text-gray-500 mb-3">當你擔任主揪時，系統會自動將此資訊顯示給球友看，方便大家匯款。</p>
                    <textarea 
                      value={editPaymentInfo} 
                      onChange={e => setEditPaymentInfo(e.target.value)} 
                      placeholder="例：台新銀行 (812) 1234-5678-9012&#10;Line Pay: (貼上你的轉帳連結)"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 h-28"
                    />
                  </div>

                  <button onClick={handleSaveProfile} className="w-full py-4 bg-gray-800 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-transform">
                    儲存個人資料
                  </button>
                </div>
              )}

              {profileTab === 'ledger' && (
                <div className="space-y-4">
                  {ongoingLedgers.length === 0 && completedLedgers.length === 0 ? (
                    <div className="text-center text-gray-400 py-10 text-sm border-2 border-dashed border-gray-200 rounded-2xl">
                      你目前還沒有擔任過主揪喔！<br/>趕快去開一團吧！
                    </div>
                  ) : (
                    <>
                      {ongoingLedgers.map(ledger => (
                        <div key={ledger.date} className="bg-white p-4 rounded-2xl shadow-sm border border-orange-200 relative">
                          <div className="flex justify-between items-start mb-3">
                            <div className="cursor-pointer group" onClick={() => jumpToDate(ledger.date)}>
                              <div className="font-bold text-gray-800 text-lg flex items-center group-hover:text-blue-600 transition-colors">
                                {ledger.date.replace('2026-', '')} <span className="ml-1 text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500">前往日曆 ➔</span>
                              </div>
                              <div className="text-xs text-emerald-600 font-bold mt-0.5">{ledger.event.venue?.name}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">預收總額</div>
                              <div className="font-bold text-gray-800">${ledger.event.totalPrice}</div>
                            </div>
                          </div>

                          <div className="mb-4">
                            <div className="flex justify-between text-xs font-bold mb-1">
                              <span className="text-emerald-600">已收 ${ledger.totalCollected}</span>
                              <span className="text-orange-500">尚缺 ${ledger.event.totalPrice - ledger.totalCollected}</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(ledger.totalCollected / ledger.event.totalPrice) * 100}%` }}></div>
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-xl p-3">
                          <div className="text-xs font-bold text-gray-500 mb-2 flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span>👀 款項核銷清單</span>
                                {/* ✨ 加上催款複製按鈕 */}
                                <button onClick={() => handleCopyText(getPaymentMsg(ledger.date, ledger.event))} className="text-[10px] bg-white border border-gray-300 px-2 py-0.5 rounded shadow-sm text-gray-600 active:scale-95 flex items-center">
                                  📋 複製催款
                                </button>
                              </div>
                              <span className="text-[10px] bg-white px-2 py-0.5 rounded border shadow-sm">每人分攤 ${ledger.pricePerPerson}</span>
                            </div>
                            
                            <div className="space-y-2">
                              {ledger.otherPlayers.sort((a: any, b: any) => (a.hasPaid === b.hasPaid ? 0 : a.hasPaid ? 1 : -1)).map((p: any) => (
                                <div key={p.id} className="flex justify-between items-center text-sm bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                  <div className="flex items-center space-x-2">
                                    <span>{p.avatar}</span>
                                    <span className={`font-medium ${p.hasPaid ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                      {p.name} <span className="text-xs">(+{p.count})</span>
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <span className={`font-bold ${p.hasPaid ? 'text-gray-400' : 'text-red-500'}`}>${(p.count || 1) * ledger.pricePerPerson}</span>
                                    <button
                                      onClick={() => handleTogglePayment(ledger.date, p.id, p.hasPaid)}
                                      className={`px-3 py-1 rounded text-xs font-bold active:scale-95 transition-all ${
                                        p.hasPaid 
                                          ? 'bg-gray-100 text-gray-500 border border-gray-200' 
                                          : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                      }`}
                                    >
                                      {p.hasPaid ? '取消' : '核銷'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}

                      {completedLedgers.length > 0 && (
                        <div className="mt-8 border-t border-gray-200 pt-6">
                          <h4 className="text-sm font-bold text-gray-400 mb-4 flex items-center"><span className="mr-2">✅</span> 已結清的歷史帳單</h4>
                          <div className="space-y-3">
                            {completedLedgers.map(ledger => (
                              <div key={ledger.date} className="bg-gray-100 p-3 rounded-xl flex justify-between items-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => jumpToDate(ledger.date)}>
                                <div>
                                  <div className="font-bold text-gray-500 flex items-center">
                                    {ledger.date.replace('2026-', '')} <span className="ml-2 text-[10px] bg-white px-1.5 rounded text-gray-400">查看 ➔</span>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-0.5">{ledger.event.venue?.name}</div>
                                </div>
                                <div className="text-emerald-600 font-bold text-sm">
                                  已收齊 ${ledger.event.totalPrice}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
      {/* ✨ 多選模式：懸浮確認按鈕 */}
      {isMultiSelectMode && multiSelectedDates.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md z-40 animate-in slide-in-from-bottom-6">
          <button 
            onClick={handleMultiSubmit} 
            className="w-full py-4 bg-blue-500 text-white font-bold rounded-2xl shadow-2xl active:scale-95 transition-transform flex items-center justify-center space-x-2 text-lg"
          >
            <span>🚀 確定報名 (共 {multiSelectedDates.length} 天)</span>
          </button>
        </div>
      )}

    </main>
  );
}