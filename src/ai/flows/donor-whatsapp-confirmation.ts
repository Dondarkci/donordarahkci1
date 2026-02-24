'use server';
/**
 * @fileOverview A Genkit flow for generating personalized WhatsApp confirmation messages for blood donors.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DonorWhatsAppConfirmationInputSchema = z.object({
  fullName: z.string().describe('The full name of the registered donor.'),
  whatsappNumber: z.string().describe('The WhatsApp number of the registered donor.'),
  locationAndDate: z
    .string()
    .describe('The chosen location and date for the blood donation (e.g., "Stasiun Juanda pada 2026-03-30").'),
});
export type DonorWhatsAppConfirmationInput = z.infer<typeof DonorWhatsAppConfirmationInputSchema>;

const DonorWhatsAppConfirmationOutputSchema = z.object({
  whatsappMessage: z.string().describe('The personalized WhatsApp message generated for the donor.'),
  status: z.literal('success').describe('The status of the confirmation message generation.'),
});
export type DonorWhatsAppConfirmationOutput = z.infer<typeof DonorWhatsAppConfirmationOutputSchema>;

export async function donorWhatsAppConfirmation(
  input: DonorWhatsAppConfirmationInput
): Promise<DonorWhatsAppConfirmationOutput> {
  return donorWhatsAppConfirmationFlow(input);
}

const whatsappMessagePrompt = ai.definePrompt({
  name: 'whatsappConfirmationMessagePrompt',
  input: {schema: DonorWhatsAppConfirmationInputSchema},
  output: {schema: DonorWhatsAppConfirmationOutputSchema},
  prompt: `You are a helpful assistant for PT. Kereta Commuter Indonesia Blood Donor events.
Generate a personalized WhatsApp confirmation message for a blood donor in Indonesian.

Information:
Full Name: {{{fullName}}}
Location and Date: {{{locationAndDate}}}

Instruction:
Generate a friendly message following this exact template:
"Hallo {{{fullName}}}, selamat anda terdaftar sebagai peserta donor darah PT. Kereta Commuter Indonesia. Sampai jumpa di {{{locationAndDate}}}"

The output must be JSON with 'whatsappMessage' and 'status' set to 'success'.`,
});

const donorWhatsAppConfirmationFlow = ai.defineFlow(
  {
    name: 'donorWhatsAppConfirmationFlow',
    inputSchema: DonorWhatsAppConfirmationInputSchema,
    outputSchema: DonorWhatsAppConfirmationOutputSchema,
  },
  async (input) => {
    const {output} = await whatsappMessagePrompt(input);
    return output!;
  }
);
