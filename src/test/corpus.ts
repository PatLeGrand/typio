import { SENTENCES_FR } from "../../scripts/seed/sentences.fr";
import { SENTENCES_EN } from "../../scripts/seed/sentences.en";
import { classifyCorpus } from "@/race/textGenerator";

export const TEST_CORPUS = classifyCorpus({ fr: SENTENCES_FR, en: SENTENCES_EN });
