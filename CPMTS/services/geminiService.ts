
import { GoogleGenAI } from "@google/genai";
import { Project, Feedback } from "../types";

export const getProjectSummary = async (project: Project): Promise<string> => {
  try {
    // Initializing inside the function to ensure the correct API key is picked up from the environment
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a concise, professional summary and status report for the following county project: 
      Title: ${project.title}
      Status: ${project.status}
      Progress: ${project.progress}%
      Budget: KES ${project.budget.toLocaleString()}
      Expenditure: KES ${project.expenditure.toLocaleString()}
      Description: ${project.description}
      Location: ${project.ward} Ward, ${project.subCounty} Sub-County.
      Focus on public impact and transparency.`,
    });
    return response.text || "Summary not available.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate AI summary.";
  }
};

export const analyzeFeedback = async (feedbacks: Feedback[]): Promise<string> => {
  if (feedbacks.length === 0) return "No feedback to analyze.";
  
  const textFeedbacks = feedbacks.map(f => `- ${f.comment} (Rating: ${f.rating}/5)`).join("\n");
  
  try {
    // Initializing inside the function to ensure the correct API key is picked up from the environment
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following public feedback for a county project and provide a sentiment summary and key action points for the government:
      ${textFeedbacks}`,
    });
    return response.text || "Analysis not available.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Analysis failed.";
  }
};
