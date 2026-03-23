import { useState } from 'react';
import { Key } from 'lucide-react';
import { getTCBSToken } from '../../services/tcbsJournal';

const OtpModal = ({ isOpen, onClose, onSuccess, allowClose }) => {
    const [otp, setOtp] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState(null);

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        try {
            setOtpLoading(true);
            setOtpError(null);
            const tokenResponse = await getTCBSToken(otp);
            // Handling based on user's manual change: tokenResponse.token vs access_token
            const tokenStr = typeof tokenResponse === 'object' ? (tokenResponse.token || tokenResponse.access_token) : tokenResponse;
            
            if (!tokenStr) throw new Error("Could not retrieve access token");

            setOtp(''); // Reset for next time
            if (onSuccess) onSuccess(tokenStr);
        } catch (err) {
            console.error("OTP Error:", err);
            setOtpError(err.message || "Failed to authenticate with TCBS");
        } finally {
            setOtpLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-full max-w-sm shadow-xl">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Key className="text-blue-400" /> TCBS Authentication
                </h3>
                <p className="text-sm text-gray-400 mb-4">Please enter your OTP to fetch trading history.</p>

                {otpError && <p className="text-red-400 text-sm mb-4 px-3 py-2 bg-red-500/10 rounded">{otpError}</p>}

                <form onSubmit={handleOtpSubmit}>
                    <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-lg mb-4 focus:outline-none focus:border-blue-500"
                        placeholder="e.g. 662127"
                        required
                    />
                    <div className="flex justify-end gap-3">
                        {allowClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={otpLoading || !otp}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition"
                        >
                            {otpLoading ? 'Verifying...' : 'Submit OTP'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OtpModal;
