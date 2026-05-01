import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchUserConversations } from '../lib/chat';

export default function InboxList() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/auth';
        return;
      }
      setCurrentUserId(user.id);
      try {
        const data = await fetchUserConversations();
        setConversations(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {conversations.length > 0 ? (
        conversations.map((conv) => {
          if (!conv) return null;
          const isBuyer = currentUserId === conv.buyer_id;
          const otherProfile = isBuyer ? conv.seller_profile : conv.buyer_profile;

          return (
            <a
              key={conv.id}
              href={`/chat?id=${conv.id}`}
              className="flex items-center gap-4 bg-card p-4 rounded-2xl border border-border hover:shadow-md transition-shadow"
            >
              <div className="w-16 h-16 rounded-xl bg-bg overflow-hidden shrink-0">
                <img
                  src={conv.listing?.photo_url || 'https://via.placeholder.com/150'}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="grow min-w-0">
                <h3 className="font-bold text-text truncate">{otherProfile?.full_name || 'Usuario'}</h3>
                <p className="text-sm text-muted flex items-center gap-1 truncate uppercase tracking-tighter font-semibold">
                  <span className="material-icons text-xs">menu_book</span>
                  {conv.listing?.title}
                </p>
              </div>
              {conv.unread_count > 0 && (
                <div className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full">
                  {conv.unread_count}
                </div>
              )}
              <span className="material-icons text-muted">chevron_right</span>
            </a>
          );
        })
      ) : (
        <div className="text-center py-20">
          <span className="material-icons text-6xl text-muted/30 mb-4">chat_bubble_outline</span>
          <p className="text-muted">No tienes mensajes todavía.</p>
        </div>
      )}
    </div>
  );
}
