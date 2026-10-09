/** Maps database / auth error codes to friendly Arabic messages. */
const MESSAGES: Record<string, string> = {
  household_full: "البيت مكتمل بالفعل — يمكن أن يضم شخصين فقط.",
  already_in_household: "أنت عضو في بيت آخر بالفعل ولديه بيانات. لا يمكن الانضمام لبيت ثانٍ.",
  no_household: "لم يتم إعداد البيت بعد.",
  not_authenticated: "انتهت الجلسة. سجّل الدخول من جديد.",
  invalid_email: "البريد الإلكتروني غير صحيح.",
  cannot_invite_self: "لا يمكنك دعوة نفسك 🙂",
  invitation_not_found: "الدعوة غير موجودة أو الرابط غير صحيح.",
  invitation_not_pending: "هذه الدعوة لم تعد صالحة (تم استخدامها أو إلغاؤها).",
  invitation_expired: "انتهت صلاحية الدعوة. اطلب دعوة جديدة.",
  invitation_email_mismatch: "هذه الدعوة مرسلة لبريد إلكتروني آخر. سجّل الدخول بالبريد المدعو.",
  owner_immutable: "لا يمكن تغيير صاحب السجل.",
  household_immutable: "لا يمكن نقل السجل لبيت آخر.",
  only_owner_can_change_visibility: "صاحب السجل فقط يمكنه تغيير الخصوصية.",
  shared_record_needs_shared_category: "السجل المشترك يحتاج تصنيفًا مشتركًا.",
  shared_record_needs_shared_account: "السجل المشترك لا يمكن ربطه بحساب خاص.",
  category_not_in_household: "التصنيف غير متاح.",
  account_not_in_household: "الحساب غير متاح.",
  bill_reference_not_allowed: "لا يمكن ربط هذا المصروف بالفاتورة.",
  installment_reference_not_allowed: "لا يمكن ربط هذا المصروف بالقسط.",
  invalid_parent_category: "التصنيف الرئيسي غير صالح.",
  shared_category_needs_shared_parent: "التصنيف المشترك يحتاج تصنيفًا رئيسيًا مشتركًا.",
  category_in_shared_use: "التصنيف مستخدم في سجلات مشتركة، لا يمكن جعله خاصًا.",
  account_in_shared_use: "الحساب مستخدم في مصاريف مشتركة، لا يمكن جعله خاصًا.",
  budget_item_needs_shared_category: "الميزانية المشتركة تقبل التصنيفات المشتركة فقط.",
  plan_not_found: "القسط غير موجود.",
  plan_has_no_category: "حدد تصنيفًا للقسط أولًا.",
  amount_exceeds_outstanding: "المبلغ أكبر من المتبقي على القسط.",
  invalid_amount: "المبلغ غير صحيح.",
  transactions_client_request_unique: "تم حفظ هذا المصروف بالفعل.",
  transactions_one_payment_per_bill_period: "تم تسجيل دفع هذه الفاتورة لهذه الفترة بالفعل.",
  installment_payments_one_per_period: "تم تسجيل هذا القسط بالفعل.",
  categories_unique_name: "يوجد تصنيف بنفس الاسم.",
  household_contributions_unique: "يوجد مساهمة مسجلة لهذا الشهر بالفعل.",
  "Invalid login credentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "User already registered": "هذا البريد مسجل بالفعل. جرّب تسجيل الدخول.",
  "Email not confirmed": "لم يتم تأكيد البريد الإلكتروني بعد. افتح رسالة التأكيد أولًا.",
  "Password should be at least 6 characters": "كلمة المرور يجب ألا تقل عن ٨ أحرف.",
  "Failed to fetch": "تعذّر الاتصال. تأكد من الإنترنت وحاول مرة أخرى.",
};

export function arabicError(error: unknown, fallback = "حدث خطأ غير متوقع. حاول مرة أخرى."): string {
  const msg = typeof error === "string" ? error : error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  if (!msg) return fallback;
  for (const [key, value] of Object.entries(MESSAGES)) if (msg.includes(key)) return value;
  if (/rate limit/i.test(msg)) return "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  if (/row-level security|permission denied/i.test(msg)) return "ليس لديك صلاحية لهذا الإجراء.";
  if (/network|fetch/i.test(msg)) return MESSAGES["Failed to fetch"];
  return fallback;
}
