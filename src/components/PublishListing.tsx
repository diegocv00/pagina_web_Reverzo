import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { sanitizeText, sanitizePrice, sanitizeInput } from '../lib/validation';

const CATEGORIES = ['Matemáticas', 'Física', 'Química', 'Clásicos', 'Fantasía', 'Ciencia Ficción', 'Misterio', 'Thriller', 'Romance', 'Poesía', 'Cuento', 'Ensayo', 'Novela', 'Biografía', 'Historia', 'Filosofía', 'Psicología', 'Autoayuda', 'Economía', 'Negocios', 'Finanzas', 'Derecho', 'Salud', 'Arte', 'Diseño', 'Arquitectura', 'Música', 'Cocina', 'Viajes', 'Deportes', 'Infantil', 'Juvenil', 'Cómic', 'Manga', 'Tecnología', 'Programación', 'Idiomas', 'Académico', 'Otros'];
const CONDITIONS = ['Nuevo', 'Como nuevo', 'Buen estado', 'Aceptable'];
const SHIPPING_OPTIONS = ['Gratis', 'A cargo del vendedor', 'A cargo del comprador'];

export default function PublishListing() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    author: '',
    editorial: '',
    isbn: '',
    price: '',
    category: '',
    condition: '',
    description: '',
    location: '',
    shippingOption: ''
  });
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    const remaining = 5 - images.length;
    if (remaining <= 0) {
      alert('Máximo 5 fotos permitidas.');
      return;
    }
    const toAdd = files.slice(0, remaining);
    const newPreviews = toAdd.map(f => URL.createObjectURL(f));
    setImages(prev => [...prev, ...toAdd]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
    if (images.length === 0 && toAdd.length > 0) {
      setCoverIndex(0);
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => {
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
    setImagePreviews(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx]);
      next.splice(idx, 1);
      return next;
    });
    if (coverIndex === idx && images.length > 1) {
      setCoverIndex(0);
    } else if (coverIndex > idx) {
      setCoverIndex(coverIndex - 1);
    }
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (images.length === 0) {
      alert('Por favor, sube al menos una foto del libro.');
      return;
    }
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Debes iniciar sesión para publicar');

      const photos: string[] = [];
      for (const file of images) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('photos')
          .getPublicUrl(filePath);

        photos.push(publicUrl);
      }

      const coverUrl = photos.length > 0 ? photos[coverIndex] : null;

      const sanitizedForm = {
        title: sanitizeText(form.title, 200),
        author: sanitizeText(form.author, 100),
        editorial: sanitizeText(form.editorial, 100),
        description: sanitizeText(form.description, 2000),
        price: sanitizePrice(form.price),
        category: sanitizeInput(form.category),
        condition: sanitizeInput(form.condition),
        location: sanitizeInput(form.location, 100),
        shipping_option: sanitizeInput(form.shippingOption),
        isbn: form.isbn.trim() || null,
      };

      if (!sanitizedForm.title || !sanitizedForm.author || !sanitizedForm.price) {
        alert('Por favor, completa los campos requeridos.');
        return;
      }

      const { error } = await supabase.from('listings').insert({
        ...sanitizedForm,
        seller_id: user.id,
        photo_url: coverUrl,
        photos: photos.length > 0 ? photos : null,
        cover_index: photos.length > 0 ? coverIndex : 0,
        status: 'active'
      });

      if (error) throw error;
      alert('Publicación creada con éxito');
      window.location.href = '/';
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-card p-4 sm:p-8 rounded-3xl border border-border shadow-sm">
      <h2 className="text-2xl font-bold mb-6 text-text">Vender un libro</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Título</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
              value={form.title}
              onChange={(e) => setForm({...form, title: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Autor</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
              value={form.author}
              onChange={(e) => setForm({...form, author: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Editorial</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
              value={form.editorial}
              onChange={(e) => setForm({...form, editorial: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">ISBN</label>
            <input
              type="text"
              placeholder="Opcional"
              className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
              value={form.isbn}
              onChange={(e) => setForm({...form, isbn: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
            <label className="block text-sm font-medium text-text mb-1">Categoría</label>
            <select
              required
              className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
              value={form.category}
              onChange={(e) => setForm({...form, category: e.target.value})}
            >
              <option value="">Selecciona una</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Estado</label>
            <select
              required
              className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
              value={form.condition}
              onChange={(e) => setForm({...form, condition: e.target.value})}
            >
              <option value="">Selecciona uno</option>
              {CONDITIONS.map(cond => <option key={cond} value={cond}>{cond}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Precio ($)</label>
            <input
              type="number"
              required
              className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
              value={form.price}
              onChange={(e) => setForm({...form, price: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Ubicación</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
              value={form.location}
              onChange={(e) => setForm({...form, location: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Fotos del libro <span className="text-muted text-xs">({images.length}/5 - haz clic para elegir portada)</span>
          </label>

          {/* Grid de miniaturas */}
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
              {imagePreviews.map((preview, idx) => (
                <div
                  key={idx}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                    idx === coverIndex ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setCoverIndex(idx)}
                >
                  <img src={preview} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  {idx === coverIndex && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Portada</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                    className="absolute top-1 right-1 bg-danger text-white p-0.5 rounded-full shadow-md"
                  >
                    <span className="material-icons text-xs">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Botón añadir más */}
          {images.length < 5 && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-6 bg-bg/50 hover:bg-bg/80 transition-colors cursor-pointer relative">
              <div className="text-center py-2">
                <span className="material-icons text-4xl text-muted/50 mb-2">add_a_photo</span>
                <p className="text-sm text-muted">Haz clic para añadir foto</p>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleImageChange}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Opción de envío</label>
          <select
            required
            className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
            value={form.shippingOption}
            onChange={(e) => setForm({...form, shippingOption: e.target.value})}
          >
            <option value="">Selecciona una opción</option>
            {SHIPPING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Descripción *</label>
          <textarea
            required
            className="w-full px-4 py-2 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-32"
            value={form.description}
            onChange={(e) => setForm({...form, description: e.target.value})}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Publicando...' : (
            <>
              Publicar ahora
              <span className="material-icons">rocket_launch</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
