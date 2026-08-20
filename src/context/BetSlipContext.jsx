import React, { createContext, useContext, useState, useEffect } from 'react';

const BetSlipContext = createContext();

export function BetSlipProvider({ children }) {
  const [slip, setSlip] = useState(() => {
    const saved = localStorage.getItem('bet_slip');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('bet_slip', JSON.stringify(slip));
  }, [slip]);

  const addToSlip = (pick) => {
    // Evitar duplicados del mismo partido
    setSlip((prev) => {
      const exists = prev.find(p => p.matchId === pick.matchId);
      if (exists) {
        // Actualizar el pick existente
        return prev.map(p => p.matchId === pick.matchId ? pick : p);
      }
      return [...prev, pick];
    });
  };

  const removeFromSlip = (matchId) => {
    setSlip((prev) => prev.filter(p => p.matchId !== matchId));
  };

  const clearSlip = () => {
    setSlip([]);
  };

  return (
    <BetSlipContext.Provider value={{ slip, addToSlip, removeFromSlip, clearSlip }}>
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  return useContext(BetSlipContext);
}
