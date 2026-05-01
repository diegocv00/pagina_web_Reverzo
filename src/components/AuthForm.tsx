import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  
  // Nuevos estados para coincidir con la App Movil
  const [userType, setUserType] = useState('persona');
  const [idType, setIdType] = useState('CC');
  const [verificationId, setVerificationId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleDateChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 4) {
      formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
    }
    if (cleaned.length > 6) {
      formatted = formatted.slice(0, 7) + '-' + cleaned.slice(6, 8);
    }
    setBirthDate(formatted.slice(0, 10));
  };

  const handleAuth = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (isSignUp) {
        if (!acceptedTerms) {
            setMessage({ type: 'error', text: 'Debes aceptar los términos y condiciones para registrarte.' });
            setLoading(false);
            return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name || email.split('@')[0],
              user_type: userType,
              verification_id: verificationId,
              id_type: userType === 'persona' ? idType : null,
              birth_date: userType === 'persona' ? birthDate : null,
              status: 'pending',
            },
          },
        });
        if (error) throw error;
        
        // Profiles upsert
        if (data?.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: name || email.split('@')[0],
            email: email,
            user_type: userType,
            verification_id: verificationId,
            id_type: userType === 'persona' ? idType : null,
            birth_date: userType === 'persona' ? birthDate : null,
            status: 'pending',
          });
          if (profileError) console.error('Error creating profile:', profileError);
        }

        setMessage({ type: 'success', text: 'Registro exitoso. Revisa tu correo electrónico.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl mt-10">
      <div className="text-center mb-8">
        <img src="/titulo.png" alt="Reverzo" className="h-20 w-auto mx-auto mb-4" />
        <p className="text-muted">{isSignUp ? 'Crea tu cuenta literaria' : 'Bienvenido de nuevo, lector'}</p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        {isSignUp && (
          <>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Nombre completo *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
               <label className="block text-sm font-medium text-text mb-1">Tipo de cuenta</label>
               <div className="flex gap-2">
                 <button 
                  type="button" 
                  onClick={() => setUserType('persona')} 
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${userType === 'persona' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-transparent text-muted border-border hover:border-primary/50'}`}
                 >Persona</button>
                 <button 
                  type="button" 
                  onClick={() => setUserType('editorial')} 
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${userType === 'editorial' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-transparent text-muted border-border hover:border-primary/50'}`}
                 >Editorial</button>
               </div>
            </div>

            {userType === 'persona' && (
               <div>
                  <label className="block text-sm font-medium text-text mb-1">Tipo de identificación *</label>
                  <div className="flex gap-2">
                    {['CC', 'PP', 'CE', 'PEP'].map(opt => (
                      <button 
                        key={opt}
                        type="button" 
                        onClick={() => setIdType(opt)} 
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${idType === opt ? 'bg-primary text-white border-primary shadow-sm' : 'bg-transparent text-muted border-border hover:border-primary/50'}`}
                      >{opt}</button>
                    ))}
                  </div>
               </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text mb-1">
                 {userType === 'editorial' ? 'NIT *' : 'Número de identificación *'}
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
                placeholder={userType === 'editorial' ? 'Ej: 9001234567' : 'Ej: 12345678'}
                value={verificationId}
                onChange={(e) => setVerificationId(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>

            {userType === 'persona' && (
              <div>
                <label className="block text-sm font-medium text-text mb-1">Fecha de nacimiento (AAAA-MM-DD) *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
                  placeholder="AAAA-MM-DD"
                  value={birthDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
              </div>
            )}
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-text mb-1">Correo electrónico *</label>
          <input
            type="email"
            required
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
            placeholder="ejemplo@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Contraseña *</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              className="w-full px-4 py-2 pr-12 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
              tabIndex={-1}
            >
              <span className="material-icons text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </div>

        {isSignUp && (
            <div className="flex items-center gap-2 mt-4 bg-bg p-3 rounded-lg border border-border">
                <input 
                    type="checkbox" 
                    id="terms"
                    className="w-5 h-5 accent-primary cursor-pointer"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                />
                <label htmlFor="terms" className="text-sm text-text cursor-pointer">
                    Acepto los <a href="https://diegocv00.github.io/Politica_privacidad_Reverzo/" target="_blank" rel="noreferrer" className="text-primary hover:underline">términos y condiciones</a>
                </label>
            </div>
        )}

        {message.text && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'}`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (isSignUp && !acceptedTerms)}
          className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 mt-4"
        >
          {loading ? 'Procesando...' : isSignUp ? 'Registrarse' : 'Iniciar sesión'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => { setIsSignUp(!isSignUp); setAcceptedTerms(false); }}
          className="text-primary font-medium hover:underline text-sm"
        >
          {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </button>
      </div>
    </div>
  );
}
