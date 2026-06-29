import React, { useState } from 'react';

export default function SearchFlights({ onSearch }) {
  const [tripType, setTripType] = useState('one-way');
  const [passengerCategory, setPassengerCategory] = useState('general');
  const [segments, setSegments] = useState([{ origin: '', destination: '', date: '' }]);
  const [returnDate, setReturnDate] = useState('');

  const handleAddSegment = () => {
    if (segments.length < 4) {
      setSegments([...segments, { origin: '', destination: '', date: '' }]);
    }
  };

  const handleUpdateSegment = (index, field, value) => {
    const updated = [...segments];
    updated[index][field] = value.toUpperCase();
    setSegments(updated);
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 max-w-4xl mx-auto my-6 text-slate-800">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Book Your Journey</h2>
      
      {/* Trip Type Selectors */}
      <div className="flex gap-4 mb-6 border-b border-slate-100 pb-3">
        {['one-way', 'round-trip', 'multi-city'].map((type) => (
          <button
            key={type}
            onClick={() => setTripType(type)}
            className={`capitalize pb-2 px-1 text-sm font-semibold transition-all ${
              tripType === type ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {type.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Dynamic Segment Rendering */}
      <div className="space-y-4">
        {segments.map((segment, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">FROM</label>
              <input
                type="text"
                placeholder="e.g. DEL"
                maxLength={3}
                value={segment.origin}
                onChange={(e) => handleUpdateSegment(idx, 'origin', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm focus:outline-indigo-500 text-slate-900 font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">TO</label>
              <input
                type="text"
                placeholder="e.g. BOM"
                maxLength={3}
                value={segment.destination}
                onChange={(e) => handleUpdateSegment(idx, 'destination', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm focus:outline-indigo-500 text-slate-900 font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">DEPARTURE DATE</label>
              <input
                type="date"
                value={segment.date}
                onChange={(e) => handleUpdateSegment(idx, 'date', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm focus:outline-indigo-500 text-slate-900"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Conditional Configuration Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {tripType === 'round-trip' && (
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">RETURN DATE</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm focus:outline-indigo-500 text-slate-900"
            />
          </div>
        )}

        {tripType === 'multi-city' && segments.length < 4 && (
          <button
            onClick={handleAddSegment}
            className="text-left text-sm font-semibold text-indigo-600 hover:text-indigo-800 self-end py-2"
          >
            + Add Another Flight Leg
          </button>
        )}

        {/* Special Concession Fares & Corporate slots */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">SPECIAL CATEGORY / CONCESSIONS</label>
          <select
            value={passengerCategory}
            onChange={(e) => setPassengerCategory(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm focus:outline-indigo-500 text-slate-900 font-medium"
          >
            <option value="general">Standard General Public Fare</option>
            <option value="defence">Armed Forces Concession (15% Off)</option>
            <option value="medical">Medical Practitioners Concession (10% Off)</option>
            <option value="corporate">Corporate Account Booking slot (12% Off)</option>
          </select>
        </div>
      </div>

      <button
        onClick={() => onSearch({ tripType, segments, returnDate, passengerCategory })}
        className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md shadow-sm transition-all text-sm tracking-wide"
      >
        SEARCH FLIGHTS
      </button>
    </div>
  );
}
