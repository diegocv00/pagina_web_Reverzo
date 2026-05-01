import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fetchMessages, sendMessage, markAsRead } from '../lib/chat';
import { sendReportEmail } from '../lib/email';

export default function ChatWindow() {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const [showMessageReportModal, setShowMessageReportModal] = useState(false);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [messageReportReason, setMessageReportReason] = useState('');

  const [sendingReportEmail, setSendingReportEmail] = useState(false);

  const [sellerRating, setSellerRating] = useState({ avg: 0, count: 0 });
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const conversationId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null;

  useEffect(() => {
    async function setupChat() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !conversationId) return;
      setUserId(user.id);

      const { data: conv } = await supabase
        .from('conversations')
        .select('*, listing:listings(title, seller_id, photo_url), buyer_profile:profiles!buyer_id(*), seller_profile:profiles!seller_id(*)')
        .eq('id', conversationId)
        .single();
      setConversation(conv);

      const msgs = await fetchMessages(conversationId);
      setMessages(msgs);
      setLoading(false);
      markAsRead(conversationId);

      // Fetch seller rating if this is a marketplace chat
      if (conv?.listing?.seller_id) {
        const { data: ratingData } = await supabase
          .from('ratings')
          .select('stars')
          .eq('seller_id', conv.listing.seller_id);
        
        if (ratingData && ratingData.length > 0) {
          const avg = ratingData.reduce((sum: number, r: any) => sum + r.stars, 0) / ratingData.length;
          setSellerRating({ avg: Math.round(avg * 10) / 10, count: ratingData.length });
        }
      }

      const channel = supabase
        .channel(`chat_${conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        }, (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          if (payload.new.sender_id !== user.id) {
            markAsRead(conversationId);
          }
        })
        .subscribe();

      return () => supabase.removeChannel(channel);
    }
    setupChat();
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!text.trim() && !uploading) return;

    const msgContent = text.trim();
    setText('');

    try {
      if (conversationId) {
        await sendMessage(conversationId as any, msgContent as any);
      }
    } catch (e) {
      alert('Error al enviar mensaje');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${conversationId}/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat_attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat_attachments')
        .getPublicUrl(filePath);

      if (conversationId && publicUrl) {
        await sendMessage(conversationId as any, '' as any, null as any, publicUrl as any);
      }
    } catch (error) {
      alert('Error al subir imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleReport = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!reportReason.trim()) return;

    setSendingReportEmail(true);
    try {
      if (!conversation) return;
      const reportedUserId = userId === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id;
      const otherProfile = userId === conversation.buyer_id ? conversation.seller_profile : conversation.buyer_profile;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      await supabase.from('reports').insert({
        reporter_id: userId,
        reported_user_id: reportedUserId,
        reason: reportReason,
        status: 'pending'
      });

      const { data: reporterProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      const reporterEmail = reporterProfile?.email || 'reverzo.app@outlook.com';
      const reportEmailTo = 'reverzo.app@outlook.com';
      const lines = [
        'Nuevo reporte de usuario',
        `Fecha: ${new Date().toISOString()}`,
        `Reporter ID: ${user.id}`,
        `Reporter Email: ${reporterEmail}`,
        `Usuario reportado ID: ${reportedUserId}`,
        `Usuario reportado: ${otherProfile?.full_name || 'n/a'}`,
        `Conversación ID: ${conversation.id}`,
        `Publicación: ${conversation.listing?.title || 'n/a'}`,
        '',
        'Motivo:',
        reportReason.trim(),
      ];
      const emailResult = await sendReportEmail({
        to_email: reportEmailTo,
        report_type: 'Reporte de Usuario',
        reporter_id: user.id,
        reporter_email: reporterEmail,
        reported_user_id: reportedUserId,
        reported_user_name: otherProfile?.full_name || 'n/a',
        message_id: null,
        reason: reportReason.trim(),
        status: 'pending',
        extra_info: lines.join('\n'),
      });
      if (!emailResult.success) {
        // EmailJS failed silently
      }

      setShowReportModal(false);
      setReportReason('');
    } catch (e) {
      alert('Error al enviar el reporte');
    } finally {
      setSendingReportEmail(false);
    }
  };

  const handleReportMessage = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!messageReportReason.trim()) return;

    setSendingReportEmail(true);
    try {
      if (!conversation || !reportingMessageId) return;
      const reportedUserId = userId === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id;
      const otherProfile = userId === conversation.buyer_id ? conversation.seller_profile : conversation.buyer_profile;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const reportedMessage = messages.find(m => m.id === reportingMessageId);

      await supabase.from('reports').insert({
        reporter_id: userId,
        reported_user_id: reportedUserId,
        message_id: reportingMessageId,
        reason: messageReportReason,
        status: 'pending'
      });

      const { data: reporterProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      const reporterEmail = reporterProfile?.email || 'reverzo.app@outlook.com';
      const reportEmailTo = 'reverzo.app@outlook.com';
      const lines = [
        'Nuevo reporte de mensaje',
        `Fecha: ${new Date().toISOString()}`,
        `Reporter ID: ${user.id}`,
        `Reporter Email: ${reporterEmail}`,
        `Usuario reportado ID: ${reportedUserId}`,
        `Usuario reportado: ${otherProfile?.full_name || 'n/a'}`,
        `Conversación ID: ${conversation.id}`,
        `Publicación: ${conversation.listing?.title || 'n/a'}`,
        `Mensaje ID: ${reportingMessageId}`,
        reportedMessage?.content ? `Contenido del mensaje: "${reportedMessage.content}"` : '',
        '',
        'Motivo del reporte:',
        messageReportReason.trim(),
      ].filter(Boolean);
      const emailResult = await sendReportEmail({
        to_email: reportEmailTo,
        report_type: 'Reporte de Mensaje',
        reporter_id: user.id,
        reporter_email: reporterEmail,
        reported_user_id: reportedUserId,
        reported_user_name: otherProfile?.full_name || 'n/a',
        message_id: reportingMessageId,
        reason: messageReportReason.trim(),
        status: 'pending',
        extra_info: lines.join('\n'),
      });
      if (!emailResult.success) {
        // EmailJS failed silently
      }

      setShowMessageReportModal(false);
      setReportingMessageId(null);
      setMessageReportReason('');
    } catch (e) {
      alert('Error al enviar el reporte del mensaje');
    } finally {
      setSendingReportEmail(false);
    }
  };

  const handleSubmitRating = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (ratingStars === 0) {
      alert('Por favor, selecciona una calificación de estrellas.');
      return;
    }

    setSubmittingRating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const otherUserId = userId === conversation?.buyer_id ? conversation?.seller_id : conversation?.buyer_id;
      if (!otherUserId) throw new Error('No se pudo identificar al usuario');

      // Check if already rated
      const { data: existingRating } = await supabase
        .from('ratings')
        .select('id')
        .eq('reviewer_id', user.id)
        .eq('seller_id', otherUserId)
        .single();

      if (existingRating) {
        alert('Ya has calificado a este usuario.');
        return;
      }

      await supabase.from('ratings').insert({
        reviewer_id: user.id,
        seller_id: otherUserId,
        listing_id: conversation?.listing?.id || null,
        stars: ratingStars,
        comment: ratingComment.trim() || null,
      });

      // Update local rating state
      const newCount = sellerRating.count + 1;
      const newAvg = ((sellerRating.avg * sellerRating.count) + ratingStars) / newCount;
      setSellerRating({ avg: Math.round(newAvg * 10) / 10, count: newCount });

      setShowRatingModal(false);
      setRatingStars(0);
      setRatingComment('');
      alert('¡Calificación enviada con éxito!');
    } catch (e: any) {
      alert('Error al enviar la calificación: ' + e.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading) return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  const otherProfile = userId === conversation?.buyer_id ? conversation?.seller_profile : conversation?.buyer_profile;

  return (
    <div className="flex flex-col h-[70vh] sm:h-[75vh] md:h-[600px] bg-card rounded-3xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-bg/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-border">
            {otherProfile?.avatar_url && <img src={otherProfile.avatar_url} className="w-full h-full object-cover" />}
          </div>
          <div>
            <h3 className="font-bold text-text text-sm">{otherProfile?.full_name || 'Usuario'}</h3>
            {conversation?.listing ? (
              <>
                <p className="text-[10px] text-muted truncate max-w-[200px] uppercase font-bold tracking-tight">
                  Sobre: {conversation.listing.title}
                </p>
                {sellerRating.count > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={`material-icons text-xs ${i < Math.round(sellerRating.avg) ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {i < Math.round(sellerRating.avg) ? 'star' : 'star_border'}
                      </span>
                    ))}
                    <span className="text-[10px] text-muted ml-1">
                      {sellerRating.avg.toFixed(1)} ({sellerRating.count})
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[10px] text-muted uppercase font-bold tracking-tight">Chat de comunidad</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowRatingModal(true)}
            className="text-muted hover:text-primary transition-colors p-2"
            title={conversation?.listing ? "Calificar vendedor" : "Calificar usuario"}
          >
            <span className="material-icons">star</span>
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="text-muted hover:text-danger transition-colors p-2"
            title="Reportar usuario"
          >
            <span className="material-icons">flag</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="grow overflow-y-auto p-4 space-y-4 bg-bg/20"
      >
        {messages.map(msg => {
          const isMe = msg.sender_id === userId;
          return (
            <div key={msg.id} className={`flex items-center ${isMe ? 'justify-end' : 'justify-start'} group gap-2`}>
              {!isMe && (
                <button
                  onClick={() => {
                    setReportingMessageId(msg.id);
                    setShowMessageReportModal(true);
                  }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-danger p-1"
                  title="Reportar mensaje"
                >
                  <span className="material-icons text-sm">flag</span>
                </button>
              )}
              <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-primary text-white rounded-br-none shadow-sm' : 'bg-white border border-border text-text rounded-bl-none shadow-sm'
                }`}>
                {msg.image_url && (
                  <img
                    src={msg.image_url}
                    alt="Imagen enviada"
                    className="rounded-lg mb-2 max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(msg.image_url, '_blank')}
                  />
                )}
                {msg.content}
                <div className={`text-[9px] mt-1 opacity-60 ${isMe ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-border flex gap-2 items-center">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleImageUpload}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-muted hover:text-primary transition-colors p-2 disabled:opacity-50"
        >
          {uploading ? (
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
          ) : (
            <span className="material-icons">add_photo_alternate</span>
          )}
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="grow px-4 py-2 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <button
          type="submit"
          className="bg-primary text-white p-2 rounded-xl hover:bg-primary-dark transition-colors shadow-sm"
        >
          <span className="material-icons">send</span>
        </button>
      </form>

      {/* Report User Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="material-icons text-danger">flag</span>
              Reportar Usuario
            </h3>
            <form onSubmit={handleReport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Motivo del reporte</label>
                <textarea
                  required
                  disabled={sendingReportEmail}
                  className="w-full px-4 py-2 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-danger/20 focus:border-danger h-32 disabled:opacity-50"
                  placeholder="Describe por qué estás reportando a este usuario..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowReportModal(false); setReportReason(''); }}
                  className="px-4 py-2 rounded-xl text-muted hover:bg-bg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingReportEmail}
                  className="px-6 py-2 bg-danger text-white rounded-xl hover:bg-danger/80 transition-colors font-bold shadow-sm disabled:opacity-50"
                >
                  {sendingReportEmail ? 'Enviando...' : 'Enviar reporte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Message Modal */}
      {showMessageReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="material-icons text-danger">flag</span>
              Reportar Mensaje
            </h3>
            <form onSubmit={handleReportMessage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Motivo del reporte</label>
                <textarea
                  required
                  disabled={sendingReportEmail}
                  className="w-full px-4 py-2 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-danger/20 focus:border-danger h-32 disabled:opacity-50"
                  placeholder="Describe por qué estás reportando este mensaje..."
                  value={messageReportReason}
                  onChange={(e) => setMessageReportReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowMessageReportModal(false); setMessageReportReason(''); }}
                  className="px-4 py-2 rounded-xl text-muted hover:bg-bg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingReportEmail}
                  className="px-6 py-2 bg-danger text-white rounded-xl hover:bg-danger/80 transition-colors font-bold shadow-sm disabled:opacity-50"
                >
                  {sendingReportEmail ? 'Enviando...' : 'Enviar reporte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="material-icons text-primary">star</span>
              Calificar {conversation?.listing ? 'vendedor' : 'usuario'}
            </h3>
            <form onSubmit={handleSubmitRating} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Tu calificación</label>
                <div className="flex gap-2 justify-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRatingStars(i + 1)}
                      className={`text-4xl transition-colors ${i < ratingStars ? 'text-yellow-400' : 'text-gray-300'}`}
                    >
                      <span className="material-icons">{i < ratingStars ? 'star' : 'star_border'}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Comentario (opcional)</label>
                <textarea
                  disabled={submittingRating}
                  className="w-full px-4 py-2 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-24 disabled:opacity-50"
                  placeholder="Comparte tu experiencia..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowRatingModal(false); setRatingStars(0); setRatingComment(''); }}
                  className="px-4 py-2 rounded-xl text-muted hover:bg-bg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingRating}
                  className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors font-bold shadow-sm disabled:opacity-50"
                >
                  {submittingRating ? 'Enviando...' : 'Enviar calificación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
