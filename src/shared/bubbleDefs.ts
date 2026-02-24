import { BubbleDef } from './types';

// Use placeholder or basic SVG/PNG paths for now. 
// Can be replaced with actual assets later.
export const BUBBLE_LIBRARY: BubbleDef[] = [
    {
        bubbleDefId: 'BD_CLASSIC',
        name: 'Classic Speech Bubble',
        templateName: 'Classic',
        type: 'speech',
        src: 'assets/bubbles/classic.png', // We'll assume these might exist, or handled via CSS if not found yet
        textRect: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 },
        defaultStyle: {
            padding: '16px',
            color: '#000000',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            border: '4px solid #000000',
        }
    },
    {
        bubbleDefId: 'BD_THOUGHT',
        name: 'Thought Bubble',
        templateName: 'Thought',
        type: 'thought',
        src: 'assets/bubbles/thought.png',
        textRect: { x: 0.15, y: 0.15, width: 0.7, height: 0.5 },
        defaultStyle: {
            padding: '20px',
            color: '#000000',
            backgroundColor: '#f8f8f8',
            borderRadius: '50%',
            border: '4px dotted #000000',
        }
    },
    {
        bubbleDefId: 'BD_SHOUT',
        name: 'Shout Bubble',
        templateName: 'Shout',
        type: 'speech',
        src: 'assets/bubbles/shout.png',
        textRect: { x: 0.2, y: 0.2, width: 0.6, height: 0.5 },
        defaultStyle: {
            padding: '12px',
            color: '#ffffff',
            backgroundColor: '#ff0000',
        }
    },
    {
        bubbleDefId: 'BD_BOX',
        name: 'Text Box',
        templateName: 'Box',
        type: 'text',
        src: '',
        textRect: { x: 0.0, y: 0.0, width: 1.0, height: 1.0 },
        defaultStyle: {
            padding: '12px',
            color: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '8px',
        }
    }
];
