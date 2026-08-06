import { getApiUrl } from '../lib/utils';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export const geminiService = {
  async generateText(
    prompt: string, 
    systemInstruction?: string, 
    history?: ChatMessage[], 
    model?: string, 
    thinking?: boolean,
    image?: { data: string; mimeType: string } | null,
    searchGrounding?: boolean,
    mapsGrounding?: boolean
  ): Promise<string> {
    const res = await this.generateTextWithGrounding(
      prompt,
      systemInstruction,
      history,
      model,
      thinking,
      image,
      searchGrounding,
      mapsGrounding
    );
    return res.text;
  },

  async generateTextWithGrounding(
    prompt: string, 
    systemInstruction?: string, 
    history?: ChatMessage[], 
    model?: string, 
    thinking?: boolean,
    image?: { data: string; mimeType: string } | null,
    searchGrounding?: boolean,
    mapsGrounding?: boolean
  ): Promise<{ text: string; groundingChunks?: any[] }> {
    try {
      const response = await fetch(getApiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: prompt, 
          systemInstruction, 
          history, 
          model, 
          thinking,
          image,
          searchGrounding,
          mapsGrounding
        }),
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch AI response');
      }
      const data = await response.json();
      return { text: data.text, groundingChunks: data.groundingChunks };
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  },

  async extractPassengers(base64Data: string, mimeType: string) {
    try {
      const response = await fetch(getApiUrl('/api/extract-passengers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mimeType }),
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to extract passengers');
      }
      return await response.json();
    } catch (error) {
      console.error("Extraction Error:", error);
      throw error;
    }
  }
};
