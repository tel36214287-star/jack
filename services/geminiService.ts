import { GoogleGenAI, Chat, GenerateContentResponse, GenerateImagesResponse, GroundingChunk, Modality } from "@google/genai";
import { AIChatResponse, GroundingSource } from "../types";

// The guidelines state that `window.aistudio` is assumed to be globally available
// and pre-configured with the necessary functions. Therefore, we do not need to
// redeclare it, as it can cause conflicts if already declared elsewhere.
// Assume window.aistudio is globally available as per guidelines for API key selection
// declare global {
//   interface Window {
//     aistudio: {
//       hasSelectedApiKey: () => Promise<boolean>;
//       openSelectKey: () => Promise<void>;
//     };
//   }
// }

let chat: Chat | null = null; // Initialize chat later to allow for API key checks
let lastGeneratedImageUrl: string | undefined = undefined; // Stores the last image generated for editing purposes

// Helper to convert data URI (base64) to a base64 string and mimeType
const dataUriToBase64 = (dataUri: string): { data: string, mimeType: string } | null => {
  const parts = dataUri.match(/^data:(image\/[a-zA-Z0-9\-\.]+);base64,(.*)$/);
  if (parts && parts.length === 3) {
    return { mimeType: parts[1], data: parts[2] };
  }
  return null;
};

// Function to get or create chat instance
const getOrCreateChat = () => {
  if (!chat) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `Você é a Jack Brito GPT, uma assistente de IA prestativa, espirituosa e com uma persona feminina, do Brasil. Sua criadora é Jack Brito. Mantenha suas respostas concisas, amigáveis e principalmente em português, sempre falando no feminino. Vá direto ao ponto e evite frases de preenchimento como "Ah, que ótima pergunta!".

Você tem várias capacidades especiais:

1.  **Geração e Renderização de Código**: Você pode gerar código HTML, CSS, JavaScript, JSON e Python. Este código será renderizado em um sandbox interativo ao vivo dentro do chat. Quando solicitada a criar algo visual ou interativo, forneça o código necessário em blocos de markdown separados e específicos da linguagem (por exemplo, \`\`\`html, \`\`\`css, \`\`\`javascript, \`\`\`python).

2.  **Execução de Python**: O código Python é executado em um ambiente WebAssembly (Pyodide) diretamente no navegador. Você deve informar à usuária sobre as seguintes capacidades e limitações:
    *   **Suportado**: Scripts de Python padrão, algoritmos, manipulação de dados e muitas bibliotecas populares como \`requests\`, \`numpy\`, \`pandas\`, \`matplotlib\`, etc., são suportados.
    *   **Não Suportado**: Frameworks de servidor como **Flask**, **Django**, ou qualquer biblioteca que dependa de operações de rede a nível de sistema (como escutar em uma porta de rede) não podem ser executados. Ao gerar código para esses frameworks, você DEVE explicar que o código é para referência e precisa ser executado em um ambiente de servidor adequado, não no sandbox do chat.
    *   **Pacotes Pyodide**: O ambiente Python (Pyodide) carregará automaticamente os pacotes de que você precisa, se eles estiverem disponíveis na biblioteca de pacotes Pyodide.

3.  **Geração de Imagens**: Você pode criar imagens de alta qualidade a partir de um prompt de texto. Basta usar o comando \`/imagem\` seguido da sua descrição. Por exemplo: \`/imagem um gato astronauta flutuando no espaço\`. A imagem será gerada e exibida diretamente no chat.

4.  **Edição de Imagens**: Você pode editar a última imagem gerada. Depois de criar uma imagem com o comando \`/imagem\`, você pode simplesmente descrever as alterações desejadas (por exemplo, "Adicione um filtro retrô" ou "Remova a pessoa no fundo"). A Jack Brito GPT aplicará as edições e apresentará a nova versão da imagem.

5.  **Simulação de Web Scraping**: Você pode simular a raspagem de uma página da web. Ao receber uma URL, use sua ferramenta de busca para analisar a estrutura, conteúdo e estilo da página. Em seguida, gere o HTML e o CSS para criar a representação visual e estrutural mais precisa possível dessa página. Explique que esta é uma simulação, pois a busca direta do lado do cliente é bloqueada pela segurança do navegador (CORS).

6.  **Geração de Código Backend**: Você pode gerar código para linguagens de servidor como PHP e ASP.NET. Como mencionado para frameworks Python, você deve informar à usuária que este código não pode ser executado no sandbox de visualização ao vivo e requer um ambiente de servidor.

7.  **Geração de Código Temático**: A usuária pode alterar o tema visual do aplicativo. Os temas disponíveis são: Cyberpunk, HQ (Quadrinhos), Halloween, Natal, Floral, Matrix e Valentine's Day. Você pode, opcionalmente, gerar código, especialmente HTML com CSS inline, que corresponda à estética do tema atualmente selecionado, se achar apropriado para a solicitação da usuária.`,
        tools: [{googleSearch: {}}],
      },
    });
  }
  return chat;
};


export const sendMessageToGemini = async (message: string): Promise<AIChatResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY }); // Always create a new instance for direct model calls for latest API key

  if (message.startsWith('/imagem ')) {
    const imagePrompt = message.substring('/imagem '.length).trim();
    if (!imagePrompt) {
      return { errorMessage: "Por favor, forneça um prompt para a imagem. Ex: /imagem um gato no espaço" };
    }

    // API Key selection for Imagen model
    if (typeof window.aistudio !== 'undefined') {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
          await window.aistudio.openSelectKey();
          // After opening selection, assume user will select. Ask them to retry.
          return { errorMessage: "Por favor, selecione sua chave de API para gerar imagens e tente novamente." };
      }
    } else {
        console.warn("window.aistudio is not defined. Skipping API key check for image generation.");
    }
    
    try {
      const imageResponse: GenerateImagesResponse = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001', // High-quality image generation model
        prompt: imagePrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1', // Default aspect ratio, can be parameterized later
        },
      });

      const base64ImageBytes: string | undefined = imageResponse.generatedImages?.[0]?.image?.imageBytes;

      if (base64ImageBytes) {
        lastGeneratedImageUrl = `data:image/jpeg;base64,${base64ImageBytes}`; // Store the generated image
        return { 
          imageUrl: lastGeneratedImageUrl,
          text: `Aqui está a imagem que criei para você com o prompt: "${imagePrompt}"` 
        };
      } else {
        return { errorMessage: "Não foi possível gerar a imagem. Tente um prompt diferente." };
      }
    } catch (error: any) {
        console.error("Error generating image:", error);
        const errorMessageLower = (error.message || '').toLowerCase();

        if (errorMessageLower.includes("requested entity was not found.")) {
             // If the key is invalid or not found, prompt selection again
             if (typeof window.aistudio !== 'undefined') {
                await window.aistudio.openSelectKey();
             }
             return { errorMessage: "Sua chave de API para imagem pode estar inválida. Por favor, selecione-a novamente e tente." };
        } else if (errorMessageLower.includes("blocked") || errorMessageLower.includes("safety policies") || errorMessageLower.includes("harmful content")) {
            return { errorMessage: "Sua solicitação de imagem foi bloqueada devido a políticas de segurança. Por favor, tente um prompt diferente." };
        } else if (errorMessageLower.includes("imagen api is only accessible to billed users")) {
            return { errorMessage: `Esta funcionalidade de geração de imagens requer que o faturamento esteja ativado para sua chave de API. Por favor, verifique a documentação de faturamento: <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" class="underline hover:text-[var(--color-accent)]">ai.google.dev/gemini-api/docs/billing</a>` };
        }
        return { errorMessage: "Desculpe, houve um erro ao gerar a imagem. Por favor, tente novamente." };
    }
  } else if (lastGeneratedImageUrl) { // If a last image exists, and it's not a /imagem command, assume it's an edit request
    const imagePart = dataUriToBase64(lastGeneratedImageUrl);
    if (!imagePart) {
        return { errorMessage: "Erro ao processar a última imagem para edição. Por favor, gere uma nova imagem." };
    }

    // API Key selection for Gemini 2.5 Flash Image model
    if (typeof window.aistudio !== 'undefined') {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
          await window.aistudio.openSelectKey();
          return { errorMessage: "Por favor, selecione sua chave de API para editar imagens e tente novamente." };
      }
    } else {
        console.warn("window.aistudio is not defined. Skipping API key check for image editing.");
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // General Image Generation and Editing Tasks
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: imagePart.data,
                            mimeType: imagePart.mimeType,
                        },
                    },
                    {
                        text: message, // The user's text prompt for editing
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE], // Must be an array with a single `Modality.IMAGE` element.
            },
        });

        const imagePartResult = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePartResult?.inlineData) {
            const base64ImageBytes: string = imagePartResult.inlineData.data;
            const mimeType: string = imagePartResult.inlineData.mimeType;
            lastGeneratedImageUrl = `data:${mimeType};base64,${base64ImageBytes}`; // Update the last generated image
            return { 
              imageUrl: lastGeneratedImageUrl,
              text: "Aqui está a sua imagem editada!" 
            };
        } else {
            return { errorMessage: "Não foi possível editar a imagem. Tente um prompt diferente." };
        }
    } catch (error: any) {
        console.error("Error editing image:", error);
        const errorMessageLower = (error.message || '').toLowerCase();
        if (errorMessageLower.includes("requested entity was not found.")) {
             if (typeof window.aistudio !== 'undefined') { await window.aistudio.openSelectKey(); }
             return { errorMessage: "Sua chave de API para imagem pode estar inválida. Por favor, selecione-a novamente e tente." };
        } else if (errorMessageLower.includes("blocked") || errorMessageLower.includes("safety policies") || errorMessageLower.includes("harmful content")) {
            return { errorMessage: "Sua solicitação de edição de imagem foi bloqueada devido a políticas de segurança. Por favor, tente um prompt diferente." };
        } else if (errorMessageLower.includes("imagen api is only accessible to billed users")) {
            return { errorMessage: `Esta funcionalidade de edição de imagens requer que o faturamento esteja ativado para sua chave de API. Por favor, verifique a documentação de faturamento: <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" class="underline hover:text-[var(--color-accent)]">ai.google.dev/gemini-api/docs/billing</a>` };
        }
        return { errorMessage: "Desculpe, houve um erro ao editar a imagem. Por favor, tente novamente." };
    }
  } else {
    // Handle regular text messages (chat bot)
    try {
      const currentChat = getOrCreateChat();
      const response: GenerateContentResponse = await currentChat.sendMessage({ message });
      
      // Extract grounding metadata and filter for web sources
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources: GroundingSource[] = groundingChunks
        ?.map((chunk: GroundingChunk) => chunk.web)
        .filter((webSource): webSource is GroundingSource => !!webSource?.uri) ?? [];

      return { text: response.text, sources };
    } catch (error) {
      console.error("Error sending message to Gemini:", error);
      // For chat, if the key is invalid, we should also prompt re-selection.
      const errorMessageLower = (error as any).message?.toLowerCase() || '';
      if (errorMessageLower.includes("requested entity was not found.")) {
        if (typeof window.aistudio !== 'undefined') {
           window.aistudio.openSelectKey();
        }
        // Reset chat to force re-creation with potentially new key on next message
        chat = null; 
        return { errorMessage: "Sua chave de API para chat pode estar inválida. Por favor, selecione-a novamente e tente." };
      }
      return { errorMessage: "Oops! Algo deu errado da minha parte. Por favor, tente perguntar novamente." };
    }
  }
};