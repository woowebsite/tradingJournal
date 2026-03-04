import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const MainLayout = () => {
    return (
        <div className="flex bg-gray-900 min-h-screen text-gray-100">
            <Sidebar />
            <Topbar />
            <div className="flex-1 mt-16 ml-64 p-8 overflow-y-auto h-[calc(100vh-4rem)]">
                <Outlet />
            </div>
        </div>
    );
};

export default MainLayout;
