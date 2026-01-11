export const extractTextFromBlocks = (blocks) => {
    if (!blocks) return '';
    if (typeof blocks === 'string') return blocks;
    if (Array.isArray(blocks)) {
        return blocks.map(block => {
            if (block.type === 'paragraph' || block.type === 'heading') {
                return block.children?.map(child => child.text).join('') || '';
            }
            return '';
        }).join('\n');
    }
    return '';
};

export const createBlocksFromText = (text) => {
    if (!text) return [];
    return [
        {
            type: 'paragraph',
            children: [{ type: 'text', text }]
        }
    ];
};
