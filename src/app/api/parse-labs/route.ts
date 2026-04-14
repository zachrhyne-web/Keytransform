import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { text, image, docType, gender } = await req.json()

    const systemPrompt = `You are a medical lab result analyzer. Extract all lab values and health metrics from the provided document.

Return ONLY a valid JSON object with exactly these fields:
{
  "parsed": [
    {"name": "Test Name", "value": "123", "unit": "mg/dL", "reference_range": "70-99", "status": "normal"}
  ],
  "summary": "2-4 sentence plain English summary: what looks good, what needs attention, and one actionable insight"${image ? ',\n  "extractedText": "full text extracted from the image"' : ''}
}

Status must be one of: "normal", "low", "high", "critical", "unknown"
Patient context: Gender: ${gender || 'not specified'}.

Extract ALL values present. Common panels to look for:
- CBC: WBC, RBC, Hemoglobin, Hematocrit, Platelets, MCV, MCH, MCHC
- Metabolic/CMP: Glucose, BUN, Creatinine, eGFR, Sodium, Potassium, Chloride, CO2, Calcium, Total Protein, Albumin, Bilirubin, ALT, AST, ALP
- Lipids: Total Cholesterol, LDL, HDL, Triglycerides, VLDL, Non-HDL
- Hormones: Testosterone (total & free), Estradiol, FSH, LH, Progesterone, DHEA-S, Cortisol, TSH, Free T3, Free T4
- Metabolic markers: HbA1c, Fasting Insulin, HOMA-IR
- Vitamins/Minerals: Vitamin D, B12, Folate, Iron, Ferritin, Magnesium, Zinc
- Inflammation: CRP, hs-CRP, ESR, Homocysteine
- Other: PSA, IGF-1, SHBG, uric acid

For status: "normal" = within reference range, "low" = below range, "high" = above range, "critical" = significantly abnormal, "unknown" = no reference provided.`

    const content: any[] = image
      ? [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: image.split(';')[0].split(':')[1],
              data: image.split(',')[1],
            },
          },
          {
            type: 'text',
            text: `Document type: ${docType || 'medical report'}. Extract all lab values from this document image.`,
          },
        ]
      : [{ type: 'text', text: `Document type: ${docType || 'medical report'}\n\n${text}` }]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
      }),
    })

    const data = await response.json()
    const textContent = (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')

    // Extract JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      return NextResponse.json(result)
    }

    return NextResponse.json({ parsed: [], summary: textContent, extractedText: '' })
  } catch (error) {
    console.error('parse-labs error:', error)
    return NextResponse.json({ error: 'Parse failed', parsed: [], summary: '' }, { status: 500 })
  }
}
