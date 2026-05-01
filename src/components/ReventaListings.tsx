import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchFavoriteIds, toggleFavorite } from '../lib/favorites';

const CATEGORIES = ['Matemáticas', 'Física', 'Química', 'Clásicos', 'Fantasía', 'Ciencia Ficción', 'Misterio', 'Thriller', 'Romance', 'Poesía', 'Cuento', 'Ensayo', 'Novela', 'Biografía', 'Historia', 'Filosofía', 'Psicología', 'Autoayuda', 'Economía', 'Negocios', 'Finanzas', 'Derecho', 'Salud', 'Arte', 'Diseño', 'Arquitectura', 'Música', 'Cocina', 'Viajes', 'Deportes', 'Infantil', 'Juvenil', 'Cómic', 'Manga', 'Tecnología', 'Programación', 'Idiomas', 'Académico', 'Otros'];

export default function ReventaListings() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [cardPhotoIndices, setCardPhotoIndices] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      let query = supabase
        .from('listings')
        .select('*, profiles:seller_id (full_name)')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.neq('seller_id', userId);
      }

      const { data: listingsData, error: listingsError } = await query;
      if (listingsError) console.error('Error fetching listings:', listingsError);
      else setListings(listingsData || []);

      if (userId) {
        const favIds = await fetchFavoriteIds().catch(() => [] as string[]);
        setFavoriteIds(new Set(favIds.map(String)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredListings = useMemo(() => {
    return listings.filter(item => {
      const matchesSearch = !searchText ||
        item.title?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.author?.toLowerCase().includes(searchText.toLowerCase());
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [listings, searchText, selectedCategory]);

  const handleToggleFavorite = async (e: React.MouseEvent, listingId: string) => {
    e.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Debes iniciar sesión para guardar favoritos.');
      window.location.href = '/auth';
      return;
    }
    const isFav = favoriteIds.has(listingId);
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
    try {
      await toggleFavorite(listingId, isFav);
    } catch (err: any) {
      console.error('Error toggling favorite:', err);
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (isFav) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
      alert('No se pudo guardar el favorito. Inténtalo de nuevo.');
    }
  };

  const handleCardClick = (listing: any) => {
    window.location.href = `/libro?id=${listing.id}`;
  };

  const getCardPhotos = (listing: any): string[] => {
    if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
      return listing.photos;
    }
    return [listing.photo_url || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=400&auto=format&fit=crop'];
  };

  const prevCardPhoto = (e: React.MouseEvent, listingId: string) => {
    e.stopPropagation();
    const listing = listings.find(l => l.id === listingId);
    if (!listing) return;
    const photos = getCardPhotos(listing);
    setCardPhotoIndices(prev => ({
      ...prev,
      [listingId]: (prev[listingId] || 0) === 0 ? photos.length - 1 : (prev[listingId] || 0) - 1
    }));
  };

  const nextCardPhoto = (e: React.MouseEvent, listingId: string) => {
    e.stopPropagation();
    const listing = listings.find(l => l.id === listingId);
    if (!listing) return;
    const photos = getCardPhotos(listing);
    setCardPhotoIndices(prev => ({
      ...prev,
      [listingId]: (prev[listingId] || 0) >= photos.length - 1 ? 0 : (prev[listingId] || 0) + 1
    }));
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <input
          type="text"
          placeholder="Buscar libros o autores..."
          className="grow px-4 py-2 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          value={searchText}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
        />
        <select
          className="px-4 py-2 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          value={selectedCategory}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <button
          onClick={() => window.location.href = '/favoritos'}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg text-muted hover:text-primary hover:border-primary transition-colors bg-white shrink-0"
          title="Mis Favoritos"
        >
          <span className="material-icons">favorite</span>
          <span className="text-sm font-medium md:hidden">Favoritos</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredListings.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredListings.map(listing => {
            const photos = getCardPhotos(listing);
            const photoIdx = cardPhotoIndices[listing.id] || 0;
            const hasMultiplePhotos = photos.length > 1;
            return (
            <div key={listing.id} onClick={() => handleCardClick(listing)} className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow group cursor-pointer">
              <div className="aspect-3/4 overflow-hidden relative">
                <img
                  src={photos[photoIdx]}
                  alt={listing.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Navigation arrows */}
                {hasMultiplePhotos && (
                  <>
                    <button
                      onClick={(e) => prevCardPhoto(e, listing.id)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                    >
                      <span className="material-icons text-sm">chevron_left</span>
                    </button>
                    <button
                      onClick={(e) => nextCardPhoto(e, listing.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                    >
                      <span className="material-icons text-sm">chevron_right</span>
                    </button>
                    {/* Photo counter */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {photoIdx + 1}/{photos.length}
                    </div>
                  </>
                )}

                <div className="absolute top-2 right-2">
                  <button
                    onClick={(e) => handleToggleFavorite(e, listing.id)}
                    className="bg-white/80 backdrop-blur w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-white transition-colors shadow-sm"
                  >
                    <span className="material-icons text-sm">{favoriteIds.has(listing.id) ? 'favorite' : 'favorite_border'}</span>
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-text truncate">{listing.title}</h3>
                <p className="text-sm text-muted mb-1 truncate">{listing.author}</p>
                <p className="text-xs text-muted/70 truncate mb-2">{listing.profiles?.full_name || 'Vendedor'}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-primary font-bold">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(listing.price)}
                  </span>
                  <span className="text-[10px] bg-bg px-2 py-0.5 rounded-full text-muted uppercase tracking-wider font-semibold">
                    {listing.condition || 'Usado'}
                  </span>
                </div>
              </div>
            </div>
          )})}
        </div>
      ) : (
        <div className="text-center py-20">
          <span className="material-icons text-6xl text-muted/30 mb-4">search_off</span>
          <p className="text-muted">No se encontraron libros que coincidan con tu búsqueda.</p>
        </div>
      )}
    </div>
  );
}
