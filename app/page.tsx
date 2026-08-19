"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from './firebase';

// 系統內建的可愛動物圖庫 (你可以隨時新增)
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
// 隨機搭配的粉彩背景色
const COLORS = ['bg-red-100', 'bg-orange-100', 'bg-amber-100', 'bg-yellow-100', 'bg-lime-100', 'bg-green-100', 'bg-emerald-100', 'bg-teal-100', 'bg-cyan-100', 'bg-sky-100', 'bg-blue-100', 'bg-indigo-100', 'bg-violet-100', 'bg-purple-100', 'bg-fuchsia-100', 'bg-pink-100', 'bg-rose-100'];

export default function Home() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // 建立新角色的狀態
  const [newName, setNewName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');

  // 1. 即時監聽 Firebase 上的「users」名單
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const loadedUsers: any[] = [];
      snapshot.forEach((doc) => {
        loadedUsers.push({ id: doc.id, ...doc.data() });
      });
      setUsers(loadedUsers);
    });
    return () => unsubscribe();
  }, []);

  // 2. 計算出「還沒被選走」的動物
  const usedAvatars = users.map(u => u.avatar);
  const availableAvatars = ANIMAL_OPTIONS.filter(animal => !usedAvatars.includes(animal));

  // 3. 登入邏輯：點擊頭像後，把資料存進瀏覽器，然後前往日曆
  const handleLogin = (user: any) => {
    localStorage.setItem('pickleball_user', JSON.stringify(user));
    router.push('/calendar');
  };

  // 4. 註冊邏輯：把新名字和頭像寫進 Firebase
  const handleCreate = async () => {
    if (!newName.trim() || !selectedAvatar) return;
    
    // 隨機抽一個顏色
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    
    await addDoc(collection(db, 'users'), {
      name: newName.trim(),
      avatar: selectedAvatar,
      color: randomColor
    });

    // 清空狀態並關閉面板
    setIsCreating(false);
    setNewName('');
    setSelectedAvatar('');
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 relative overflow-hidden">
      
      <h1 className="text-2xl font-bold text-gray-800 mb-10 tracking-wide shadow-sm bg-white py-3 px-6 rounded-full">
        🎾 新竹匹克球揪團
      </h1>

      <div className="grid grid-cols-3 gap-6 w-full max-w-sm">
        
        {/* 渲染所有已註冊的球友 */}
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => handleLogin(user)}
            className="flex flex-col items-center justify-center space-y-2 hover:scale-105 transition-transform duration-200 active:scale-95"
          >
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-md ${user.color}`}>
              {user.avatar}
            </div>
            <span className="text-gray-700 font-medium text-sm">{user.name}</span>
          </button>
        ))}

        {/* 新增球友按鈕 */}
        <button 
          onClick={() => setIsCreating(true)}
          className="flex flex-col items-center justify-center space-y-2 hover:scale-105 transition-transform duration-200 active:scale-95"
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl text-gray-400 bg-white border-2 border-dashed border-gray-300 shadow-sm">
            ＋
          </div>
          <span className="text-gray-500 font-medium text-sm">建立專屬頭像</span>
        </button>
      </div>

      {/* --- 建立角色的滑出面板 --- */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex justify-center items-end bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-white rounded-t-[2.5rem] shadow-2xl flex flex-col relative animate-in slide-in-from-bottom-full duration-300 p-8 pb-12">
            
            <button 
              onClick={() => setIsCreating(false)}
              className="absolute right-6 top-6 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold text-gray-800 mb-6">建立你的專屬身分</h3>
            
            <div className="space-y-6">
              {/* 輸入名稱 */}
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-2">你要叫什麼名字？</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如：殺球王阿華"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* 選擇頭像 */}
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-2">挑選一個代表你的動物（先搶先贏）</label>
                <div className="grid grid-cols-5 gap-3 h-48 overflow-y-auto pr-2 pb-4">
                  {availableAvatars.map(animal => (
                    <button
                      key={animal}
                      onClick={() => setSelectedAvatar(animal)}
                      className={`text-3xl p-2 rounded-xl transition-all ${selectedAvatar === animal ? 'bg-blue-100 ring-2 ring-blue-400 scale-110' : 'bg-gray-50 hover:bg-gray-100'}`}
                    >
                      {animal}
                    </button>
                  ))}
                  {/* 被選走的動物顯示為灰色且不能點 */}
                  {usedAvatars.map(animal => (
                    <button key={`used-${animal}`} disabled className="text-3xl p-2 rounded-xl bg-gray-50 opacity-20 cursor-not-allowed grayscale">
                      {animal}
                    </button>
                  ))}
                </div>
              </div>

              {/* 確認按鈕 */}
              <button 
                onClick={handleCreate}
                disabled={!newName.trim() || !selectedAvatar}
                className={`w-full py-4 font-bold rounded-2xl shadow-lg transition-all ${(!newName.trim() || !selectedAvatar) ? 'bg-gray-200 text-gray-400' : 'bg-gray-800 text-white hover:bg-gray-700 active:scale-95'}`}
              >
                註冊並進入大廳
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}