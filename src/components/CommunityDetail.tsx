import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { sendReportEmail } from '../lib/email';

export default function CommunityDetail() {
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);

  const [posts, setPosts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [postsOffset, setPostsOffset] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [sendingReport, setSendingReport] = useState(false);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingTargetUserId, setRatingTargetUserId] = useState<string | null>(null);

  const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null;

  useEffect(() => {
    async function fetchCommunity() {
      if (!id) {
        setError(true);
        setLoading(false);
        return;
      }

      // Fetch user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Fetch community details
      const { data, error: fetchError } = await supabase
        .from('communities')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !data) {
        setError(true);
      } else {
        setCommunity(data);

        // If logged in, check if member or creator
        if (user) {
          if (data.creator_id === user.id) {
            setIsJoined(true);
          } else {
            const { data: memberData } = await supabase
              .from('community_members')
              .select('*')
              .eq('community_id', id)
              .eq('user_id', user.id)
              .single();
            if (memberData) setIsJoined(true);
          }
        }

        // Reset pagination on community change
        setPostsOffset(0);
        setHasMorePosts(true);

        // Fetch posts
        const { data: postsData } = await supabase
          .from('community_posts')
          .select(`
            *,
            profiles(full_name, avatar_url)
          `)
          .eq('community_id', id)
          .order('created_at', { ascending: false })
          .limit(25);

        if (postsData) {
          // Reverse to have oldest top, newest bottom visually for normal chat flow
          const reversed = postsData.reverse();
          setPosts(reversed);
          setHasMorePosts(reversed.length === 25);
        }

        // Fetch members - separate lookup to avoid FK join issues
        const { data: membersRaw } = await supabase
          .from('community_members')
          .select('user_id')
          .eq('community_id', id);

        if (membersRaw && membersRaw.length > 0) {
          const membersWithProfiles = await Promise.all(
            membersRaw.map(async (m: any) => {
              const { data: prof } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', m.user_id)
                .single();
              return { user_id: m.user_id, profiles: prof };
            })
          );
          setMembers(membersWithProfiles);
        }

      }
      setLoading(false);
    }
    fetchCommunity();
  }, [id]);

  if (loading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  if (error || !community) {
    if (typeof window !== 'undefined') window.location.href = '/comunidades';
    return null;
  }

  const handleSend = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!text.trim() && !uploading) return;

    const msgContent = text.trim();
    setText('');

    setSending(true);
    try {
      const { data: postData, error } = await supabase
        .from('community_posts')
        .insert({
          community_id: community.id,
          user_id: currentUserId,
          content: msgContent
        })
        .select('*, profiles(full_name, avatar_url)')
        .single();

      if (error) throw error;
      setPosts([...posts, postData]);

      // Scroll to bottom ideally, but let's keep it simple
      setTimeout(() => {
        const chatBox = document.getElementById('chat-box');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      }, 100);

    } catch (err: any) {
      alert("Error al enviar mensaje: " + err.message);
    } finally {
      setSending(false);
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
      const filePath = `community_attachments/${community.id}/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('community_attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('community_attachments')
        .getPublicUrl(filePath);

      const { data: postData, error } = await supabase
        .from('community_posts')
        .insert({
          community_id: community.id,
          user_id: currentUserId,
          content: '',
          image_url: publicUrl
        })
        .select('*, profiles(full_name, avatar_url)')
        .single();

      if (error) throw error;
      setPosts([...posts, postData]);

      setTimeout(() => {
        const chatBox = document.getElementById('chat-box');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      }, 100);

    } catch (err: any) {
      alert('Error al subir imagen: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLoadMorePosts = async () => {
    if (!id || loadingMorePosts || !hasMorePosts) return;
    setLoadingMorePosts(true);
    try {
      const newOffset = postsOffset + 25;
      const { data: postsData } = await supabase
        .from('community_posts')
        .select(`
          *,
          profiles(full_name, avatar_url)
        `)
        .eq('community_id', id)
        .order('created_at', { ascending: false })
        .range(newOffset, newOffset + 24);

      if (postsData && postsData.length > 0) {
        const reversed = postsData.reverse();
        setPosts(prev => [...reversed, ...prev]);
        setPostsOffset(newOffset);
      }
      setHasMorePosts((postsData || []).length === 25);
    } catch (e: any) {
      alert('Error al cargar más mensajes');
    } finally {
      setLoadingMorePosts(false);
    }
  };

  const handleReportPost = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!reportReason.trim()) return;

    setSendingReport(true);
    try {
      if (!reportingPostId) return;
      const post = posts.find(p => p.id === reportingPostId);
      if (!post) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const reportPayload = {
        reporter_id: user.id,
        reported_user_id: post.user_id,
        message_id: null,
        reason: [
          `Post ID: ${reportingPostId}`,
          `Comunidad: ${community?.name || 'n/a'}`,
          `Contenido: ${post.content || 'n/a'}`,
          '',
          'Motivo:',
          reportReason.trim(),
        ].join('\n'),
        status: 'pending'
      };
      const { error: reportError } = await supabase.from('reports').insert(reportPayload);
      if (reportError) {
        throw reportError;
      }

      const { data: reporterProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      const reporterEmail = reporterProfile?.email || 'reverzo.app@outlook.com';
      const reportEmailTo = 'reverzo.app@outlook.com';
      const lines = [
        'Nuevo reporte de mensaje de comunidad',
        `Fecha: ${new Date().toISOString()}`,
        `Reporter ID: ${user.id}`,
        `Reporter Email: ${reporterEmail}`,
        `Usuario reportado ID: ${post.user_id}`,
        `Usuario reportado: ${post.profiles?.full_name || 'n/a'}`,
        `Comunidad: ${community?.name || 'n/a'}`,
        `Comunidad ID: ${community?.id || 'n/a'}`,
        `Post ID: ${reportingPostId}`,
        post.content ? `Contenido del mensaje: "${post.content}"` : '',
        '',
        'Motivo del reporte:',
        reportReason.trim(),
      ].filter(Boolean);

      const emailResult = await sendReportEmail({
        to_email: reportEmailTo,
        report_type: 'Reporte de Mensaje de Comunidad',
        reporter_id: user.id,
        reporter_email: reporterEmail,
        reported_user_id: post.user_id,
        reported_user_name: post.profiles?.full_name || 'n/a',
        message_id: null,
        reason: reportReason.trim(),
        status: 'pending',
        extra_info: lines.join('\n'),
      });
      if (!emailResult.success) {
        // EmailJS failed silently
      }
      setShowReportModal(false);
      setReportingPostId(null);
      setReportReason('');
    } catch (e) {
      alert('Error al enviar el reporte');
    } finally {
      setSendingReport(false);
    }
  };

  const handleJoin = async () => {
    if (!currentUserId) {
      window.location.href = '/auth';
      return;
    }
    try {
      const { error } = await supabase
        .from('community_members')
        .insert({
          community_id: community.id,
          user_id: currentUserId,
          role: 'member',
          status: 'approved'
        });

      if (error) throw error;
      setIsJoined(true);
    } catch (err: any) {
      alert("Error al unirse: " + err.message);
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
      if (!ratingTargetUserId) throw new Error('No se pudo identificar al usuario');

      // Check if already rated
      const { data: existingRating } = await supabase
        .from('ratings')
        .select('id')
        .eq('reviewer_id', user.id)
        .eq('seller_id', ratingTargetUserId)
        .single();

      if (existingRating) {
        alert('Ya has calificado a este usuario.');
        return;
      }

      await supabase.from('ratings').insert({
        reviewer_id: user.id,
        seller_id: ratingTargetUserId,
        listing_id: null,
        stars: ratingStars,
        comment: ratingComment.trim() || null,
      });

      setShowRatingModal(false);
      setRatingStars(0);
      setRatingComment('');
      setRatingTargetUserId(null);
      alert('¡Calificación enviada con éxito!');
    } catch (e: any) {
      alert('Error al enviar la calificación: ' + e.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-card rounded-3xl border border-border overflow-hidden mb-8">
        <div className="h-48 bg-linear-to-r from-primary/20 to-primary/10 relative">
          <div className="absolute -bottom-12 left-4 sm:left-8 flex items-end gap-3 sm:gap-6">
            <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-3xl bg-card p-1 shadow-xl border border-border overflow-hidden">
              {community.photo_url ? (
                <img src={community.photo_url} alt={community.name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <div className="w-full h-full bg-bg flex items-center justify-center text-primary/30">
                  <span className="material-icons text-4xl sm:text-6xl">groups</span>
                </div>
              )}
            </div>
            <div className="pb-6">
              <h1 className="text-xl sm:text-3xl font-bold text-text">{community.name}</h1>
              <p className="text-primary font-medium text-sm sm:text-base">{community.topic}</p>
            </div>
          </div>
        </div>
        <div className="pt-16 pb-6 sm:pb-8 px-4 sm:px-8">
          <div className="flex justify-between items-start">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold mb-2">Acerca de esta comunidad</h2>
              <p className="text-muted leading-relaxed">
                {community.description || 'Bienvenido a esta comunidad. Aquí compartimos el amor por la lectura y los libros.'}
              </p>
            </div>

            {isJoined ? (
              <button disabled className="font-bold py-3 px-8 rounded-2xl transition-colors shadow-sm bg-card border border-border text-primary hover:bg-bg cursor-default">
                Unido
              </button>
            ) : (
              <button onClick={handleJoin} className="font-bold py-3 px-8 rounded-2xl transition-colors shadow-sm bg-primary hover:bg-primary-dark text-white">
                Unirme al club
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 px-4 sm:px-0">
        <div className="md:col-span-2 space-y-6 flex flex-col h-[60vh] md:h-[600px]">
          <div className="bg-card rounded-2xl border border-border flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-border bg-bg/50">
              <h3 className="font-bold text-text">Foro de la comunidad</h3>
            </div>

            {/* Mensajes */}
            <div id="chat-box" className="flex-1 p-6 overflow-y-auto space-y-4 flex flex-col">
              {posts.length === 0 ? (
                <div className="text-center py-10 my-auto">
                  <span className="material-icons text-4xl text-muted/30 mb-2">forum</span>
                  <p className="text-muted text-sm">Aún no hay mensajes. ¡Sé el primero en saludar!</p>
                </div>
              ) : (
                <>
                  {hasMorePosts && (
                    <div className="flex justify-center py-2">
                      <button
                        onClick={handleLoadMorePosts}
                        disabled={loadingMorePosts}
                        className="text-xs text-muted hover:text-primary font-medium px-3 py-1.5 rounded-full bg-bg border border-border hover:border-primary transition-colors disabled:opacity-50"
                      >
                        {loadingMorePosts ? 'Cargando...' : 'Cargar más mensajes'}
                      </button>
                    </div>
                  )}
                  {posts.map(post => {
                  const isMine = post.user_id === currentUserId;
                  return (
                    <div key={post.id} className={`flex w-full items-center ${isMine ? 'justify-end' : 'justify-start'} gap-2 group`}>
                      {!isMine && (
                        <>
                          <button
                            onClick={() => {
                              setRatingTargetUserId(post.user_id);
                              setShowRatingModal(true);
                            }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-primary p-1"
                            title="Calificar usuario"
                          >
                            <span className="material-icons text-sm">star</span>
                          </button>
                          <button
                            onClick={() => {
                              setReportingPostId(post.id);
                              setShowReportModal(true);
                            }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-danger p-1"
                            title="Reportar mensaje"
                          >
                            <span className="material-icons text-sm">flag</span>
                          </button>
                        </>
                      )}
                      <div className={`max-w-[75%] rounded-2xl p-3 ${isMine ? 'bg-primary text-white rounded-tr-sm' : 'bg-bg text-text border border-border rounded-tl-sm'}`}>
                        {!isMine && (
                          <p className="text-xs font-bold mb-1 opacity-70">
                            {post.profiles?.full_name || 'Usuario'}
                          </p>
                        )}
                        {post.image_url && (
                          <img
                            src={post.image_url}
                            alt="Imagen enviada"
                            className="rounded-lg mb-2 max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(post.image_url, '_blank')}
                          />
                        )}
                        {post.content && <p className="text-sm wrap-break-word">{post.content}</p>}
                        <p className={`text-[10px] mt-1 text-right ${isMine ? 'text-primary-light/80' : 'text-muted'}`}>
                          {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                </>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card">
              {isJoined ? (
                <form onSubmit={handleSend} className="flex gap-2">
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
                    className="flex-1 bg-bg border border-border rounded-full px-4 py-2 text-sm outline-none focus:border-primary transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={sending || (!text.trim() && !uploading)}
                    className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 transition-opacity"
                  >
                    <span className="material-icons text-xl">send</span>
                  </button>
                </form>
              ) : (
                <div className="text-center p-2 text-sm text-muted bg-bg rounded-lg">
                  Únete a la comunidad para poder participar en el foro.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-bold mb-4">Miembros ({members.length})</h3>
            <div className="flex flex-wrap gap-2">
              {members.slice(0, 15).map(member => (
                <div key={member.user_id} className="relative group/m">
                  <button
                    onClick={() => window.location.href = `/perfil?userId=${member.user_id}`}
                    className="w-10 h-10 rounded-full border border-border bg-bg overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {member.profiles?.avatar_url ? (
                      <img src={member.profiles.avatar_url} alt={member.profiles?.full_name || 'miembro'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-icons text-primary/30 text-lg">person</span>
                    )}
                  </button>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/m:block z-10 pointer-events-none">
                    <div className="bg-text text-bg text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap shadow-md">
                      {member.profiles?.full_name || 'Usuario'}
                    </div>
                    <div className="w-2 h-2 bg-text rotate-45 mx-auto -mt-1"></div>
                  </div>
                </div>
              ))}
              {members.length > 15 && (
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-bg border border-border text-xs font-bold text-muted">
                  +{members.length - 15}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report Post Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="material-icons text-danger">flag</span>
              Reportar Mensaje
            </h3>
            <form onSubmit={handleReportPost} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Motivo del reporte</label>
                <textarea
                  required
                  disabled={sendingReport}
                  className="w-full px-4 py-2 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-danger/20 focus:border-danger h-32 disabled:opacity-50"
                  placeholder="Describe por qué estás reportando este mensaje..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowReportModal(false); setReportingPostId(null); setReportReason(''); }}
                  className="px-4 py-2 rounded-xl text-muted hover:bg-bg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingReport}
                  className="px-6 py-2 bg-danger text-white rounded-xl hover:bg-danger/80 transition-colors font-bold shadow-sm disabled:opacity-50"
                >
                  {sendingReport ? 'Enviando...' : 'Enviar reporte'}
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
              Calificar usuario
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
                  onClick={() => { setShowRatingModal(false); setRatingStars(0); setRatingComment(''); setRatingTargetUserId(null); }}
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
