import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sendReportEmail } from '../lib/email';

const CATEGORIES = ['Matemáticas', 'Física', 'Química', 'Clásicos', 'Fantasía', 'Ciencia Ficción', 'Misterio', 'Thriller', 'Romance', 'Poesía', 'Cuento', 'Ensayo', 'Novela', 'Biografía', 'Historia', 'Filosofía', 'Psicología', 'Autoayuda', 'Economía', 'Negocios', 'Finanzas', 'Derecho', 'Salud', 'Arte', 'Diseño', 'Arquitectura', 'Música', 'Cocina', 'Viajes', 'Deportes', 'Infantil', 'Juvenil', 'Cómic', 'Manga', 'Tecnología', 'Programación', 'Idiomas', 'Académico', 'Otros'];

export default function ListingDetail() {
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', author: '', editorial: '', description: '', price: '', condition: '', location: '', category: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [sendingReport, setSendingReport] = useState(false);

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [sellerRating, setSellerRating] = useState({ avg: 0, count: 0 });
  const [loadingRatings, setLoadingRatings] = useState(false);

  const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null;

  useEffect(() => {
    async function fetchListing() {
      if (!id) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        // Fetch user and listing in parallel
        const [userResult, listingResult] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from('listings')
            .select(`
              *,
              profiles:seller_id (full_name, avatar_url)
            `)
            .eq('id', id)
            .single()
        ]);

        const user = userResult.data?.user ?? null;
        const { data, error: fetchError } = listingResult;

        setCurrentUser(user);

        if (fetchError) {
          setError(true);
          return;
        }

        if (!data) {
          setError(true);
          return;
        }

        setListing(data);

        // Load seller rating asynchronously after main content (mobile version approach)
        setLoadingRatings(true);
        try {
          const { data: ratingData, error: ratingsError } = await supabase
            .from('ratings')
            .select('stars')
            .eq('seller_id', data.seller_id);

          if (!ratingsError && ratingData && ratingData.length > 0) {
            const avg = ratingData.reduce((sum: number, r: any) => sum + r.stars, 0) / ratingData.length;
            setSellerRating({ avg: Math.round(avg * 10) / 10, count: ratingData.length });
          } else {
            setSellerRating({ avg: 0, count: 0 });
          }
        } catch (e) {
          setSellerRating({ avg: 0, count: 0 });
        } finally {
          setLoadingRatings(false);
        }
      } catch (err: any) {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchListing();
  }, [id]);

  const handleContact = async () => {
      if (!currentUser) {
          window.location.href = '/auth';
          return;
      }
      if (listing.seller_id === currentUser.id) {
          return; // Seller checking their own book
      }

      setCreatingChat(true);

      try {
          // Check if conversation exists
          const { data: existingConvos, error: queryError } = await supabase
              .from('conversations')
              .select('id')
              .eq('listing_id', listing.id)
              .eq('buyer_id', currentUser.id)
              .eq('seller_id', listing.seller_id);
              
          if (queryError) throw queryError;

          if (existingConvos && existingConvos.length > 0) {
              // Exists, redirect
              window.location.href = `/chat?id=${existingConvos[0].id}`;
          } else {
              // Create new
              const { data: newConvo, error: createError } = await supabase
                  .from('conversations')
                  .insert({
                      listing_id: listing.id,
                      buyer_id: currentUser.id,
                      seller_id: listing.seller_id
                  })
                  .select('id')
                  .single();

              if (createError) throw createError;
              
              // Redirect to chat
              window.location.href = `/chat?id=${newConvo.id}`;
          }
      } catch (err: any) {
          alert('Hubo un error al contactar al vendedor: ' + err.message);
          setCreatingChat(false);
      }
  };

  if (loading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  if (error || !listing) {
    if (typeof window !== 'undefined') window.location.href = '/reventa';
    return null;
  }

  const isMine = currentUser?.id === listing.seller_id;

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex items-center gap-2 mb-6 cursor-pointer text-muted hover:text-primary transition-colors" onClick={() => window.history.back()}>
          <span className="material-icons">arrow_back</span>
          <span className="font-bold text-sm">Volver al catálogo</span>
      </div>

      <div className="bg-card rounded-3xl border border-border overflow-hidden grid grid-cols-1 md:grid-cols-2 shadow-sm">
        
        {/* Lado Imagen */}
        <div className="bg-bg flex flex-col items-center justify-center p-0 md:p-0 relative min-h-[60vh]">
            {(() => {
                const photos = (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0)
                    ? listing.photos
                    : [listing.photo_url || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=400&auto=format&fit=crop'];
                const hasMultiple = photos.length > 1;
                return (
                    <>
                        <div className="relative w-full h-full min-h-[60vh] overflow-hidden bg-black/5">
                            <div
                                id="photo-scroll"
                                className="w-full h-full overflow-x-auto snap-x snap-mandatory flex scroll-smooth"
                                style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                onScroll={(e) => {
                                    const el = e.currentTarget;
                                    const idx = Math.round(el.scrollLeft / el.clientWidth);
                                    setActivePhotoIndex(idx);
                                }}
                            >
                                {photos.map((url: string, idx: number) => (
                                    <div key={idx} className="w-full h-full shrink-0 snap-center flex items-center justify-center bg-black/5">
                                        <img
                                            src={url}
                                            alt={`${listing.title} ${idx + 1}`}
                                            className="w-full min-h-[30vh] sm:min-h-[40vh] md:min-h-[50vh] lg:min-h-[60vh] object-contain bg-slate-100 cursor-pointer"
                                            onClick={() => setFullscreenImage(url)}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Navigation arrows */}
                            {hasMultiple && (
                                <>
                                    <button
                                        onClick={() => {
                                            const container = document.getElementById('photo-scroll');
                                            if (container) {
                                                const next = activePhotoIndex === 0 ? photos.length - 1 : activePhotoIndex - 1;
                                                container.scrollLeft = container.clientWidth * next;
                                                setActivePhotoIndex(next);
                                            }
                                        }}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/95 hover:bg-white text-text rounded-full flex items-center justify-center shadow-xl backdrop-blur-sm transition-all hover:scale-110"
                                    >
                                        <span className="material-icons text-xl">chevron_left</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const container = document.getElementById('photo-scroll');
                                            if (container) {
                                                const next = activePhotoIndex >= photos.length - 1 ? 0 : activePhotoIndex + 1;
                                                container.scrollLeft = container.clientWidth * next;
                                                setActivePhotoIndex(next);
                                            }
                                        }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/95 hover:bg-white text-text rounded-full flex items-center justify-center shadow-xl backdrop-blur-sm transition-all hover:scale-110"
                                    >
                                        <span className="material-icons text-xl">chevron_right</span>
                                    </button>
                                </>
                            )}

                            {/* Dots + counter overlay */}
                            {hasMultiple && (
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full">
                                    <span className="text-white text-sm font-bold min-w-[28px] text-center">{activePhotoIndex + 1}/{photos.length}</span>
                                    <div className="w-px h-4 bg-white/30" />
                                    <div className="flex gap-2">
                                        {photos.map((_: string, idx: number) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    const container = document.getElementById('photo-scroll');
                                                    if (container) container.scrollLeft = container.clientWidth * idx;
                                                    setActivePhotoIndex(idx);
                                                }}
                                                className={`w-2.5 h-2.5 rounded-full transition-all ${idx === activePhotoIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                );
            })()}
        </div>

        {/* Fullscreen Image Modal */}
        {fullscreenImage && (
            <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={() => setFullscreenImage(null)}>
                <button className="absolute top-4 right-4 text-white hover:text-white/80 transition-colors" onClick={() => setFullscreenImage(null)}>
                    <span className="material-icons text-4xl">close</span>
                </button>
                <img src={fullscreenImage} alt="Fullscreen" className="max-h-[90vh] max-w-full object-contain rounded-lg" />
            </div>
        )}

        {/* Lado Información */}
        <div className="p-8 md:p-10 flex flex-col h-full relative">
            {!isMine && (
                <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-red-50 border border-red-100 text-danger hover:bg-red-100 hover:text-danger transition-colors shadow-sm"
                    title="Reportar publicación"
                >
                    <span className="material-icons text-sm">flag</span>
                </button>
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-text mb-2">{listing.title}</h1>
            <p className="text-lg text-primary font-medium mb-6">{listing.author}</p>
            
            <div className="mb-8">
                <span className="text-4xl font-bold text-text">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(listing.price)}
                </span>
            </div>

            <div className="space-y-4 mb-8 grow">
                <h3 className="font-bold text-text">Descripción del estado</h3>
                <p className="text-muted leading-relaxed">
                    {listing.description || 'El vendedor no proporcionó una descripción adicional para este libro.'}
                </p>

                <div className="grid grid-cols-2 gap-3 text-sm mt-4">
                    {listing.editorial && (
                        <div className="bg-bg rounded-xl p-3">
                            <p className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Editorial</p>
                            <p className="text-text font-medium">{listing.editorial}</p>
                        </div>
                    )}
                    {listing.isbn && (
                        <div className="bg-bg rounded-xl p-3">
                            <p className="text-xs text-muted uppercase tracking-wider font-bold mb-1">ISBN</p>
                            <p className="text-text font-medium">{listing.isbn}</p>
                        </div>
                    )}
                    {listing.location && (
                        <div className="bg-bg rounded-xl p-3">
                            <p className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Ubicación</p>
                            <p className="text-text font-medium">{listing.location}</p>
                        </div>
                    )}
                    {listing.category && (
                        <div className="bg-bg rounded-xl p-3">
                            <p className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Categoría</p>
                            <p className="text-text font-medium">{listing.category}</p>
                        </div>
                    )}
                    <div className="bg-bg rounded-xl p-3">
                        <p className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Estado</p>
                        <p className="text-text font-medium">{listing.condition || 'No especificado'}</p>
                    </div>
                    <div className="bg-bg rounded-xl p-3">
                        <p className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Publicado</p>
                        <p className="text-text font-medium">
                            {listing.created_at ? new Date(listing.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No disponible'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="border-t border-border pt-6 mt-8">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => window.location.href = `/perfil?userId=${listing.seller_id}`}
                        className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                    >
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-bg border border-border">
                            {listing.profiles?.avatar_url ? (
                                <img src={listing.profiles.avatar_url} alt="vendedor" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-primary/30">
                                    <span className="material-icons">person</span>
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-xs text-muted uppercase tracking-wider font-bold mb-0.5">Vendedor</p>
                            <p className="font-bold text-text">{listing.profiles?.full_name || 'Usuario Anónimo'}</p>
                            <div className="flex items-center gap-1 mt-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <span key={i} className={`material-icons text-sm ${i < Math.round(sellerRating.avg) ? 'text-yellow-400' : 'text-gray-300'}`}>
                                    {i < Math.round(sellerRating.avg) ? 'star' : 'star_border'}
                                  </span>
                                ))}
                                <span className="text-xs text-muted ml-1">
                                  {sellerRating.avg > 0 ? `${sellerRating.avg.toFixed(1)} (${sellerRating.count} valoraciones)` : 'Nuevo'}
                                </span>
                            </div>
                        </div>
                    </button>
                </div>

                {isMine ? (
                    <div className="space-y-3">
                        {listing.status !== 'sold' && (
                            <button 
                                onClick={async () => {
                                    if (!confirm('¿Estás seguro de que quieres marcar este libro como vendido?')) return;
                                    try {
                                        const { error } = await supabase.from('listings').update({ status: 'sold' }).eq('id', listing.id);
                                        if (error) throw error;
                                        setListing({ ...listing, status: 'sold' });
                                        alert('¡Libro marcado como vendido!');
                                    } catch (err: any) {
                                        alert('Error: ' + err.message);
                                    }
                                }}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 transition-colors text-white font-bold py-4 rounded-2xl flex justify-center items-center gap-2 shadow-sm"
                            >
                                <span className="material-icons">check_circle</span>
                                Marcar como vendido
                            </button>
                        )}
                        {listing.status === 'sold' && (
                            <button disabled className="w-full bg-gray-400 text-white font-bold py-4 rounded-2xl flex justify-center items-center gap-2 cursor-default opacity-70">
                                <span className="material-icons">sell</span>
                                Producto vendido
                            </button>
                        )}
                        {listing.status !== 'sold' && (
                            <button 
                                onClick={() => {
                                    setEditForm({
                                        title: listing.title || '',
                                        author: listing.author || '',
                                        editorial: listing.editorial || '',
                                        description: listing.description || '',
                                        price: String(listing.price || ''),
                                        condition: listing.condition || '',
                                        location: listing.location || '',
                                        category: listing.category || '',
                                    });
                                    setIsEditModalOpen(true);
                                }}
                                className="w-full bg-primary hover:bg-primary-dark transition-colors text-white font-bold py-4 rounded-2xl flex justify-center items-center gap-2 shadow-sm"
                            >
                                <span className="material-icons">edit</span>
                                Editar publicación
                            </button>
                        )}
                    </div>
                ) : (
                    <button 
                        onClick={handleContact}
                        disabled={creatingChat}
                        className="w-full bg-primary hover:bg-primary-dark transition-colors text-white font-bold py-4 rounded-2xl flex justify-center items-center gap-2 shadow-sm disabled:opacity-70"
                    >
                        <span className="material-icons">forum</span>
                        {creatingChat ? 'Iniciando chat...' : 'Contactar al vendedor'}
                    </button>
                )}
            </div>
        </div>

      </div>

      {/* Report Listing Modal */}
      {isReportModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-border flex justify-between items-center bg-bg/50">
                      <h3 className="font-bold text-text flex items-center gap-2">
                          <span className="material-icons text-danger">flag</span>
                          Reportar publicación
                      </h3>
                      <button onClick={() => { setIsReportModalOpen(false); setReportReason(''); }} className="text-muted hover:text-danger">
                          <span className="material-icons">close</span>
                      </button>
                  </div>
                  <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!reportReason.trim()) {
                          alert('Por favor, describe el motivo del reporte.');
                          return;
                      }
                      setSendingReport(true);
                      try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) throw new Error('No autenticado');

                          const { error } = await supabase.from('reports').insert({
                              reporter_id: user.id,
                              reported_user_id: listing.seller_id,
                              message_id: null,
                              reason: reportReason.trim(),
                              status: 'pending',
                          });
                          if (error) throw error;

                          const { data: reporterProfile } = await supabase
                              .from('profiles')
                              .select('email')
                              .eq('id', user.id)
                              .single();

                          const reporterEmail = reporterProfile?.email || 'reverzo.app@outlook.com';
                          const reportEmailTo = 'reverzo.app@outlook.com';
                          const lines = [
                              'Nuevo reporte de publicación',
                              `Fecha: ${new Date().toISOString()}`,
                              `Reporter ID: ${user.id}`,
                              `Reporter Email: ${reporterEmail}`,
                              `Vendedor ID: ${listing.seller_id}`,
                              `Publicación ID: ${listing.id}`,
                              `Título: ${listing.title}`,
                              '',
                              'Motivo:',
                              reportReason.trim(),
                          ];
                          const emailResult = await sendReportEmail({
                              to_email: reportEmailTo,
                              report_type: 'Reporte de Publicación',
                              reporter_id: user.id,
                              reporter_email: reporterEmail,
                              reported_user_id: listing.seller_id,
                              reported_user_name: listing.seller_name || 'n/a',
                              message_id: null,
                              reason: reportReason.trim(),
                              status: 'pending',
                              extra_info: lines.join('\n'),
                          });
                          if (!emailResult.success) {
                              // EmailJS failed silently
                          }
                      } catch (err: any) {
                          alert('Error al enviar el reporte: ' + err.message);
                      } finally {
                          setSendingReport(false);
                      }
                  }} className="p-6 space-y-4 overflow-y-auto">
                      <p className="text-sm text-muted">Cuéntanos por qué reportas <span className="font-bold text-text">"{listing.title}"</span></p>
                      <textarea
                          required
                          disabled={sendingReport}
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                          placeholder="Describe el motivo (precio falso, estafa, ofensivo...)"
                          className="w-full px-4 py-3 border border-border rounded-xl focus:border-danger outline-none bg-bg text-text h-32 resize-none disabled:opacity-50"
                      />
                      <div className="flex gap-3 justify-end">
                          <button type="button" onClick={() => { setIsReportModalOpen(false); setReportReason(''); }} className="px-4 py-2 rounded-xl text-muted hover:bg-bg transition-colors font-bold">
                              Cancelar
                          </button>
                          <button disabled={sendingReport} type="submit" className="px-6 py-2 bg-danger hover:bg-danger/80 text-white rounded-xl transition-colors font-bold shadow-sm disabled:opacity-50">
                              {sendingReport ? 'Enviando...' : 'Enviar reporte'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Edit Listing Modal */}
      {isEditModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-border flex justify-between items-center bg-bg/50">
                      <h3 className="font-bold text-text">Editar publicación</h3>
                      <button onClick={() => setIsEditModalOpen(false)} className="text-muted hover:text-danger"><span className="material-icons">close</span></button>
                  </div>
                  <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!editForm.condition) {
                          alert('Por favor, selecciona un estado.');
                          return;
                      }
                      setSavingEdit(true);
                      try {
                          const priceNum = parseInt(editForm.price.replace(/[^0-9]/g, ''), 10);
                          if (!priceNum || priceNum <= 0) throw new Error('Precio no válido');
                          const { error } = await supabase.from('listings').update({
                              title: editForm.title.trim(),
                              author: editForm.author.trim(),
                              editorial: editForm.editorial.trim(),
                              description: editForm.description.trim(),
                              price: priceNum,
                              condition: editForm.condition,
                              location: editForm.location.trim(),
                              category: editForm.category,
                          }).eq('id', listing.id);
                          if (error) throw error;
                          setListing({ ...listing, ...editForm, price: priceNum });
                          setIsEditModalOpen(false);
                          alert('Publicación actualizada correctamente.');
                      } catch (err: any) {
                          alert('Error al guardar: ' + err.message);
                      } finally {
                          setSavingEdit(false);
                      }
                  }} className="p-6 space-y-4 overflow-y-auto">
                      <div>
                          <label className="block text-sm font-bold text-text mb-1">Título</label>
                          <input type="text" required value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} className="w-full px-4 py-2 border border-border rounded-xl focus:border-primary outline-none bg-bg text-text" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-text mb-1">Autor</label>
                          <input type="text" required value={editForm.author} onChange={(e) => setEditForm({...editForm, author: e.target.value})} className="w-full px-4 py-2 border border-border rounded-xl focus:border-primary outline-none bg-bg text-text" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-text mb-1">Editorial *</label>
                          <input type="text" required value={editForm.editorial} onChange={(e) => setEditForm({...editForm, editorial: e.target.value})} className="w-full px-4 py-2 border border-border rounded-xl focus:border-primary outline-none bg-bg text-text" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-text mb-1">Precio (COP)</label>
                          <input type="number" required value={editForm.price} onChange={(e) => setEditForm({...editForm, price: e.target.value})} className="w-full px-4 py-2 border border-border rounded-xl focus:border-primary outline-none bg-bg text-text" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-text mb-1">Categoría *</label>
                          <select required value={editForm.category} onChange={(e) => setEditForm({...editForm, category: e.target.value})} className="w-full px-4 py-2 border border-border rounded-xl focus:border-primary outline-none bg-bg text-text">
                              <option value="">Selecciona una categoría</option>
                              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-text mb-1">Estado</label>
                          <div className="flex flex-wrap gap-2">
                              {['Nuevo', 'Como nuevo', 'Buen estado', 'Aceptable'].map(c => (
                                  <button key={c} type="button" onClick={() => setEditForm({...editForm, condition: c})} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${editForm.condition === c ? 'bg-primary text-white border-primary' : 'bg-bg text-muted border-border hover:border-primary/50'}`}>{c}</button>
                              ))}
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-text mb-1">Ubicación *</label>
                          <input type="text" required value={editForm.location} onChange={(e) => setEditForm({...editForm, location: e.target.value})} className="w-full px-4 py-2 border border-border rounded-xl focus:border-primary outline-none bg-bg text-text" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-text mb-1">Descripción *</label>
                          <textarea required value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} className="w-full px-4 py-2 border border-border rounded-xl focus:border-primary outline-none bg-bg text-text h-24 resize-none" />
                      </div>
                      <button disabled={savingEdit} type="submit" className="w-full bg-primary hover:bg-primary-dark transition-colors text-white font-bold py-3 rounded-xl disabled:opacity-50">
                          {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
