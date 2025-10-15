import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EmotionData {
  emotion: string;
  sentiment: number;
  confidence: number;
  indicators: string[];
  tone: string[];
  analysis: string;
  timestamp: Date;
  speaker: string;
}

interface EmotionAnalyticsProps {
  meetingId: string;
  transcripts: Array<{
    speaker_id: string;
    content: string;
    timestamp: string;
  }>;
}

const emotionColors: Record<string, string> = {
  joy: 'bg-green-500',
  sadness: 'bg-blue-500',
  anger: 'bg-red-500',
  fear: 'bg-purple-500',
  surprise: 'bg-yellow-500',
  disgust: 'bg-orange-500',
  neutral: 'bg-gray-500',
};

export const EmotionAnalytics = ({ meetingId, transcripts }: EmotionAnalyticsProps) => {
  const [emotions, setEmotions] = useState<EmotionData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [overallSentiment, setOverallSentiment] = useState(0);

  useEffect(() => {
    if (transcripts.length > 0) {
      analyzeEmotions();
    }
  }, [transcripts]);

  const analyzeEmotions = async () => {
    setIsAnalyzing(true);
    try {
      const emotionPromises = transcripts.slice(-5).map(async (transcript) => {
        const { data, error } = await supabase.functions.invoke('emotion-analytics', {
          body: {
            text: transcript.content,
            context: 'Meeting conversation',
          },
        });

        if (error) throw error;

        return {
          ...data,
          timestamp: new Date(transcript.timestamp),
          speaker: transcript.speaker_id,
        };
      });

      const results = await Promise.all(emotionPromises);
      setEmotions(results);

      // Calculate overall sentiment
      const avgSentiment = results.reduce((sum, e) => sum + e.sentiment, 0) / results.length;
      setOverallSentiment(avgSentiment);
    } catch (error) {
      console.error('Error analyzing emotions:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 0.2) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (sentiment < -0.2) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 0.5) return 'Very Positive';
    if (sentiment > 0.2) return 'Positive';
    if (sentiment > -0.2) return 'Neutral';
    if (sentiment > -0.5) return 'Negative';
    return 'Very Negative';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Emotion Analytics
          </CardTitle>
          {isAnalyzing && (
            <Badge variant="secondary">Analyzing...</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Sentiment */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Sentiment</span>
            <div className="flex items-center gap-2">
              {getSentimentIcon(overallSentiment)}
              <span className="text-sm">{getSentimentLabel(overallSentiment)}</span>
            </div>
          </div>
          <Progress 
            value={(overallSentiment + 1) * 50} 
            className="h-2"
          />
        </div>

        {/* Emotion Timeline */}
        <div>
          <h4 className="text-sm font-medium mb-2">Recent Emotions</h4>
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {emotions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No emotion data yet</p>
                  <p className="text-sm">Emotions will be analyzed as people speak</p>
                </div>
              ) : (
                emotions.map((emotion, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${emotionColors[emotion.emotion]}`} />
                        <span className="text-sm font-medium capitalize">
                          {emotion.emotion}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {emotion.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getSentimentIcon(emotion.sentiment)}
                      <Progress 
                        value={emotion.confidence * 100} 
                        className="h-1 flex-1"
                      />
                      <span className="text-xs text-muted-foreground">
                        {Math.round(emotion.confidence * 100)}%
                      </span>
                    </div>

                    {emotion.tone.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {emotion.tone.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {emotion.analysis && (
                      <p className="text-xs text-muted-foreground italic">
                        {emotion.analysis}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};
