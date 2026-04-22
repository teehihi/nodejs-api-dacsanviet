const geminiService = require('../../services/geminiService');

exports.chatWithAI = async (req, res) => {
    try {
        const { message, history, context } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp nội dung tin nhắn.'
            });
        }

        // history nên là một mảng các object { role: 'user' | 'model', parts: [{ text: '...' }] }
        const reply = await geminiService.chatWithAI(message, history || [], context || {});

        res.json({
            success: true,
            data: {
                reply: reply
            }
        });
    } catch (error) {
        console.error('AI Controller Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Đã có lỗi xảy ra khi xử lý yêu cầu AI.'
        });
    }
};
