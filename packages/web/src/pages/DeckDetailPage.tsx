import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Deck {
  id: string;
  title: string;
  description: string | null;
  cardCount: number;
  newCount: number;
  dueCount: number;
}

interface Card {
  id: string;
  front: string;
  back: string;
  state: string;
  tags: string[] | null;
  createdAt: string;
}

export function DeckDetailPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');

  const { data: deck } = useQuery({
    queryKey: ['deck', deckId],
    queryFn: () => api.get<Deck>(`/decks/${deckId}`),
    enabled: !!deckId,
  });

  const { data: cardsData } = useQuery({
    queryKey: ['cards', deckId],
    queryFn: () =>
      api.get<{ cards: Card[]; total: number }>(
        `/decks/${deckId}/cards?limit=200`
      ),
    enabled: !!deckId,
  });

  const addCard = useMutation({
    mutationFn: (body: { deckId: string; front: string; back: string }) =>
      api.post('/cards', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', deckId] });
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] });
      setNewFront('');
      setNewBack('');
    },
  });

  const updateCard = useMutation({
    mutationFn: (body: { cardId: string; front: string; back: string }) =>
      api.patch(`/cards/${body.cardId}`, {
        front: body.front,
        back: body.back,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', deckId] });
      setEditingId(null);
    },
  });

  const deleteCard = useMutation({
    mutationFn: (cardId: string) => api.delete(`/cards/${cardId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', deckId] });
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] });
    },
  });

  const deleteDeck = useMutation({
    mutationFn: () => api.delete(`/decks/${deckId}`),
    onSuccess: () => navigate('/'),
  });

  const handleAdd = () => {
    if (!newFront.trim() || !newBack.trim() || !deckId) return;
    addCard.mutate({
      deckId,
      front: newFront.trim(),
      back: newBack.trim(),
    });
  };

  const startEdit = (card: Card) => {
    setEditingId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
  };

  const handleUpdate = () => {
    if (!editingId || !editFront.trim() || !editBack.trim()) return;
    updateCard.mutate({
      cardId: editingId,
      front: editFront.trim(),
      back: editBack.trim(),
    });
  };

  const cards = cardsData?.cards ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded-md hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {deck?.title ?? '...'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {deck?.cardCount ?? 0} 张卡片 · {deck?.newCount ?? 0} 新 ·{' '}
            {deck?.dueCount ?? 0} 待复习
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          添加卡片
        </button>
        <button
          onClick={() => {
            if (confirm('确定删除此牌组及所有卡片？')) deleteDeck.mutate();
          }}
          className="p-2 text-red-500 rounded-lg hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Add card form */}
      {showAdd && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                正面
              </label>
              <textarea
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                placeholder="问题 / 术语..."
                rows={3}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                背面
              </label>
              <textarea
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                placeholder="答案 / 解释..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAdd}
              disabled={addCard.isPending}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              添加
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewFront('');
                setNewBack('');
              }}
              className="px-4 py-1.5 text-gray-600 rounded-md text-sm hover:bg-gray-100"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* Card list */}
      {cards.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>还没有卡片，点击上方添加</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <div
              key={card.id}
              className="p-4 bg-white rounded-lg border border-gray-200"
            >
              {editingId === card.id ? (
                <div>
                  <div className="grid grid-cols-2 gap-4">
                    <textarea
                      value={editFront}
                      onChange={(e) => setEditFront(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    />
                    <textarea
                      value={editBack}
                      onChange={(e) => setEditBack(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleUpdate}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">
                        正面
                      </span>
                      <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">
                        {card.front}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">
                        背面
                      </span>
                      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">
                        {card.back}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(card)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('确定删除此卡片？'))
                          deleteCard.mutate(card.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
