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

        const maxRetries = 3;
        const retryDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

                const model = this.genAI.getGenerativeModel({ 
                    model: 'gemini-2.5-flash',
                    systemInstruction: {
                        parts: [{
                            text: `
Bạn là chuyên gia phân tích kinh doanh và trợ lý thông minh của hệ thống "Đặc Sản Việt". 
Dữ liệu hiện tại của cửa hàng: ${JSON.stringify(optimizedContext)}

HƯỚNG DẪN PHONG CÁCH HỘI THOẠI:
1. Trả lời bằng tiếng Việt, giọng điệu thân thiện, nhiệt tình như một người cộng sự đang trò chuyện trực tiếp.
2. Viết thành các đoạn văn liền mạch, mượt mà. TUYỆT ĐỐI KHÔNG dùng emoji hay icon bất kỳ.
3. Dùng **in đậm** để nhấn mạnh các số liệu, tên sản phẩm, và kết luận quan trọng.
4. Đưa ra phân tích sâu sắc nhưng trình bày như đang kể chuyện hoặc tư vấn trực tiếp.
5. Luôn bám sát dữ liệu cửa hàng để đưa ra lời khuyên hành động thực tế.
                            `
                        }]
                    }
                });

                let validHistory = Array.isArray(history) ? history : [];
                while (validHistory.length > 0 && validHistory[0].role !== 'user') {
                    validHistory = validHistory.slice(1);
                }

                const chat = model.startChat({
                    history: validHistory,
                    generationConfig: {
                        maxOutputTokens: 2000,
                        temperature: 0.7,
                    },
                });

                const result = await chat.sendMessage(userQuery);
                const response = result.response;
                return response.text();

            } catch (error) {
                const is503 = error.message && (error.message.includes('503') || error.message.includes('Service Unavailable') || error.message.includes('high demand'));
                console.error(`❌ Gemini Chat Error (attempt ${attempt}/${maxRetries}):`, error.message);

                if (is503 && attempt < maxRetries) {
                    const delay = attempt * 2000; // 2s, 4s
                    console.log(`⏳ Retrying in ${delay}ms...`);
                    await retryDelay(delay);
                    continue;
                }

                if (is503) {
                    throw new Error('Trợ lý AI đang quá tải, vui lòng thử lại sau ít phút nhé!');
                }
                throw new Error('Trợ lý AI đang bận xử lý. Bạn đợi một lát rồi nhắn lại nhé!');
            }
        }
    }
}

module.exports = new GeminiService();
