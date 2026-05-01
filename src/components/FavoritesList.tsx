import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchFavorites, toggleFavorite } from '../lib/favorites';

export default function FavoritesList() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchFavorites();
        setListings(data || []);
      } catch (err) {
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleRemoveFavorite = async (id: string) => {
    try {
      await toggleFavorite(id, true);
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      alert('No se pudo eliminar el favorito. Inténtalo de nuevo.');
    }
  };

  if (!user) {
    return (
      <div className="text-center py-20">
        <span className="material-icons text-6xl text-muted/30 mb-4">lock</span>
        <h2 className="text-xl font-bold text-text mb-2">Inicia sesión para ver tus favoritos</h2>
        <p className="text-muted mb-6">Debes tener una cuenta para guardar y ver tus libros favoritos.</p>
        <a
          href="/auth"
          className="inline-block bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-2xl transition-colors"
        >
          Iniciar sesión
        </a>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-text mb-6">Mis Favoritos</h2>
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : listings.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {listings.map((listing) => (
            <div
              key={listing.id}
              onClick={() => (window.location.href = `/libro?id=${listing.id}`)}
              className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow group cursor-pointer"
            >
              <div className="aspect-3/4 overflow-hidden relative">
                <img
                  src={
                    listing.photo_url ||
                    'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=400&auto=format&fit=crop'
                  }
                  alt={listing.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 right-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFavorite(listing.id);
                    }}
                    className="bg-white/80 backdrop-blur w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-white transition-colors shadow-sm"
                  >
                    <span className="material-icons text-sm">favorite</span>
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-text truncate">{listing.title}</h3>
                <p className="text-sm text-muted mb-1 truncate">{listing.author}</p>
                <p className="text-xs text-muted/70 truncate mb-2">{listing.profiles?.full_name || 'Vendedor'}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-primary font-bold">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
                      listing.price
                    )}
                  </span>
                  <span className="text-[10px] bg-bg px-2 py-0.5 rounded-full text-muted uppercase tracking-wider font-semibold">
                    {listing.condition || 'Usado'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <span className="material-icons text-6xl text-muted/30 mb-4">favorite_border</span>
          <p className="text-muted">No tienes libros favoritos guardados.</p>
          <p className="text-sm text-muted/70 mt-2">Explora el mercadillo y guarda los libros que te interesen.</p>
          <a
            href="/"
            className="inline-block mt-6 bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-2xl transition-colors"
          >
            Explorar libros
          </a>
        </div>
      )}
    </div>
  );
}
