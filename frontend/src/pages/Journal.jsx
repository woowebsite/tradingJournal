import { useState, useEffect } from 'react';
import { getTCBSProfile } from '../services/tcbsJournal';
import { Key, User } from 'lucide-react';
import OrderHistory from '../containers/Journal/OrderHistory';
import OtpModal from '../components/otpModal';

const Journal = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [jwtToken, setJwtToken] = useState(() => sessionStorage.getItem('tcbsJwtToken') || null);
    const [showOtpModal, setShowOtpModal] = useState(!jwtToken);

    const fetchProfile = async (token) => {
        try {
            setLoading(true);
            setError(null);
            const cusCode = import.meta.env.VITE_TCBS_CUSTODYCODE;
            if (!cusCode) {
                throw new Error("VITE_TCBS_CUSTODYCODE is not configured.");
            }

            const profileData = await getTCBSProfile(cusCode, token);
            setProfile(profileData || null);
        } catch (err) {
            console.error("Error fetching profile:", err);
            setError(err.message || 'Failed to fetch user profile');
            // If token is invalid/expired, ask for OTP again
            if (err.message.includes('401') || err.message.includes('Unauthorized')) {
                setJwtToken(null);
                sessionStorage.removeItem('tcbsJwtToken');
                setShowOtpModal(true);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (jwtToken && !showOtpModal) {
            fetchProfile(jwtToken);
        }
    }, [jwtToken, showOtpModal]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Trading Journal</h2>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowOtpModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition"
                        title="Re-authenticate TCBS"
                    >
                        <Key size={18} />
                        Auth
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {profile && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6 flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <User size={32} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            {profile.fullName || profile.customerName || profile.name || import.meta.env.VITE_TCBS_CUSTODYCODE}
                        </h3>
                        <div className="mt-2 text-sm text-gray-400 grid grid-cols-2 gap-x-8 gap-y-2">
                            {profile.email && <p>Email: <span className="text-gray-200">{profile.email}</span></p>}
                            {profile.mobile && <p>Phone: <span className="text-gray-200">{profile.mobile}</span></p>}
                            {profile.username && <p>Username: <span className="text-gray-200">{profile.username}</span></p>}
                            <p>Status: <span className="text-green-400">{profile.status || 'Active'}</span></p>
                            {/* Feel free to add more fields if needed */}
                        </div>
                    </div>
                </div>
            )}

            <OrderHistory
                jwtToken={jwtToken}
                onAuthError={() => {
                    setJwtToken(null);
                    sessionStorage.removeItem('tcbsJwtToken');
                    setShowOtpModal(true);
                }}
            />

            <OtpModal
                isOpen={showOtpModal}
                allowClose={!!jwtToken}
                onClose={() => setShowOtpModal(false)}
                onSuccess={(tokenStr) => {
                    setJwtToken(tokenStr);
                    sessionStorage.setItem('tcbsJwtToken', tokenStr);
                    setShowOtpModal(false);
                }}
            />
        </div>
    );
};

export default Journal;
