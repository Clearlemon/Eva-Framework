/** Eva field: media. */
(function(){'use strict';window.EvaFields=window.EvaFields||{};window.EvaFields.media={props:['field','modelValue'],emits:['update:modelValue'],template:[
'<eva-media :model-value="modelValue" :multiple="!!field.multiple"',
' :mime="field.library || field.media_type || field.mime || \'all\'" :library="field.library || field.media_type || field.mime || \'all\'"',
' :title="field.title || \'选择媒体附件\'" :button-title="field.button_title || \'选择附件\'"',
' :placeholder="field.placeholder || \'拖拽图片、视频、音频或文档到此处\'"',
' :return-type="field.return_type || field.returnType || \'id\'"',
' :max-size="field.max_size || field.maxSize || 20" :max-items="field.max_items || field.max || field.limit || 0"',
' :allowed-types="field.allowed_types || field.mime_types || \'\'" :preview="field.preview !== false"',
' :show-drop="field.show_drop !== false && field.showDrop !== false" :sortable="!!field.sortable && !!field.multiple"',
 ' :gallery="false" :show-meta="field.show_meta !== false" :layout="field.layout || (field.gallery ? \'grid\' : \'list\')" :image-size="field.image_size || field.imageSize || \'full\'" :allow-external="!!field.allow_external || !!field.allowExternal" :editable-meta="!!field.editable_meta || !!field.editableMeta" :group-by="field.group_by || field.groupBy || \'\'" :min-width="field.min_width || field.minWidth || 0" :max-width="field.max_width || field.maxWidth || 0" :allow-batch-url="!!field.allow_batch_url || !!field.allowBatchUrl" @update:model-value="$emit(\'update:modelValue\',$event)"></eva-media>'].join('')};})();
