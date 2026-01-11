import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const MainLayout = () => {
    return (
        <div className="flex bg-gray-900 min-h-screen text-gray-100">
            <Sidebar />
            <div className="flex-1 p-8 overflow-y-auto ml-64">
                <Outlet />
            </div>
        </div>
    );
};

export default MainLayout;
