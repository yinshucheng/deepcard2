import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Plus, Layers, BookOpen, Clock } from 'lucide-react';
import { api } from '@/lib/api';

interface DeckWithStats {
  id: string;
  title: string;
  description: string | null;
  coverColor: string | null;
  cardCount: number;
  newCount: number;
  dueCount: number;
  createdAt: string;
}

export function DecksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data: decks, isLoading } = useQuery({
    queryKey: ['decks'],
    queryFn: () => api.get<DeckWithStats[]>('/decks'),
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => api.post('/decks', { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] });
      setShowCreate(false);
      setNewTitle('');
    },
  });

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createMutation.mutate(newTitle.trim());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        加载中...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">我的牌组</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          新建牌组
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="输入牌组名称..."
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              创建
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setNewTitle('');
              }}
              className="px-4 py-1.5 text-gray-600 rounded-md text-sm hover:bg-gray-100"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {!decks?.length ? (
        <div className="text-center py-20 text-gray-400">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>还没有牌组，点击右上角创建第一个吧</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <button
              key={deck.id}
              onClick={() => navigate(`/decks/${deck.id}`)}
              className="text-left p-5 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <h3 className="font-semibold text-gray-900 mb-1">
                {deck.title}
              </h3>
              {deck.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {deck.description}
                </p>
              )}
              <div className="flex gap-4 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  {deck.cardCount} 张
                </span>
                <span className="inline-flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  {deck.newCount} 新
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {deck.dueCount} 待复习
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
