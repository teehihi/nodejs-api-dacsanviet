const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            console.warn('⚠️ GEMINI_API_KEY not found in environment variables');
            return;
        }
        this.genAI = new GoogleGenerativeAI(this.apiKey);
    }

    async chatWithAI(userQuery, history = [], storeContext = {}) {
        if (!this.apiKey) {
            return "Vui lòng cấu hình GEMINI_API_KEY trong file .env để sử dụng tính năng này.";
        }

        try {
            // Tối ưu dữ liệu context
            const optimizedContext = {
                totalRevenue: storeContext.totalRevenue,
                totalOrders: storeContext.totalOrders,
                totalProducts: storeContext.totalProducts,
                totalUsers: storeContext.totalUsers,
                revenueData: Array.isArray(storeContext.revenueData) 
                    ? storeContext.revenueData.slice(-7) 
                    : storeContext.revenueData
            };

            // Sử dụng systemInstruction để AI luôn nhớ ngữ cảnh trong suốt cuộc hội thoại
            const model = this.genAI.getGenerativeModel({ 
                model: 'gemini-flash-latest',
                systemInstruction: {
                    role: 'system',
                    parts: [{
                        text: `
Bạn là chuyên gia phân tích kinh doanh và trợ lý thông minh của hệ thống "Đặc Sản Việt". 
Dữ liệu hiện tại của cửa hàng: ${JSON.stringify(optimizedContext)}

HƯỚNG DẪN PHONG CÁCH HỘI THOẠI:
1. Trả lời bằng tiếng Việt, giọng điệu thân thiện, nhiệt tình như một người cộng sự đang trò chuyện trực tiếp.
2. Viết thành các đoạn văn liền mạch, mượt mà. Tránh lạm dụng dấu sao (**), gạch đầu dòng khô khan hay bảng biểu cứng nhắc.
3. Sử dụng Emoji (🚀, ✨, 📈) một cách tinh tế để tăng sự gần gũi.
4. Đưa ra phân tích sâu sắc nhưng trình bày như đang kể chuyện hoặc tư vấn trực tiếp.
5. Luôn bám sát dữ liệu cửa hàng để đưa ra lời khuyên hành động thực tế.
                        `
                    }]
                }
            });

            // Khởi tạo chat với lịch sử tin nhắn
            const chat = model.startChat({
                history: history,
                generationConfig: {
                    maxOutputTokens: 2000, // Tăng giới hạn để không bị đứt đoạn câu dài
                    temperature: 0.7,      // Giúp câu văn tự nhiên, linh hoạt hơn
                },
            });

            const result = await chat.sendMessage(userQuery);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('❌ Gemini Chat Error:', error.message);
            throw new Error('Trợ lý AI đang bận xử lý. Bạn đợi một lát rồi nhắn lại nhé!');
        }
    }
}

module.exports = new GeminiService();
