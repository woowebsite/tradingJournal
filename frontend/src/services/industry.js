import api from './api';

export const getIndustries = async () => {
    const response = await api.get('/industries');
    return response.data.data || [];
};

export const createIndustry = async (data) => {
    const response = await api.post('/industries', data);
    return response.data;
};

export const syncIndustries = async (industries) => {
    const response = await api.post('/industries/bulk', { data: industries });
    return response.data;
};

export const syncIndustriesFromTCBS = async () => {
    return {
        "listIndustry": [
            {
                "id": 240,
                "name": "Bán lẻ",
                "code": "5300"
            },
            {
                "id": 280,
                "name": "Bảo hiểm",
                "code": "8500"
            },
            {
                "id": 334,
                "name": "Bất động sản",
                "code": "8600"
            },
            {
                "id": 305,
                "name": "Công nghệ Thông tin",
                "code": "9500"
            },
            {
                "id": 142,
                "name": "Dầu khí",
                "code": "0500"
            },
            {
                "id": 281,
                "name": "Dịch vụ tài chính",
                "code": "8700"
            },
            {
                "id": 271,
                "name": "Điện, nước & xăng dầu khí đốt",
                "code": "7500"
            },
            {
                "id": 242,
                "name": "Du lịch và Giải trí",
                "code": "5700"
            },
            {
                "id": 171,
                "name": "Hàng & Dịch vụ Công nghiệp",
                "code": "2700"
            },
            {
                "id": 203,
                "name": "Hàng cá nhân & Gia dụng",
                "code": "3700"
            },
            {
                "id": 147,
                "name": "Hóa chất",
                "code": "1300"
            },
            {
                "id": 279,
                "name": "Ngân hàng",
                "code": "8300"
            },
            {
                "id": 201,
                "name": "Ô tô và phụ tùng",
                "code": "3300"
            },
            {
                "id": 148,
                "name": "Tài nguyên Cơ bản",
                "code": "1700"
            },
            {
                "id": 202,
                "name": "Thực phẩm và đồ uống",
                "code": "3500"
            },
            {
                "id": 241,
                "name": "Truyền thông",
                "code": "5500"
            },
            {
                "id": 264,
                "name": "Viễn thông",
                "code": "6500"
            },
            {
                "id": 170,
                "name": "Xây dựng và Vật liệu",
                "code": "2300"
            },
            {
                "id": 231,
                "name": "Y tế",
                "code": "4500"
            }
        ]
    };
};