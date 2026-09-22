/** Eva field: gallery. */
(function(){'use strict';window.EvaFields=window.EvaFields||{};window.EvaFields.gallery={props:['field','modelValue'],emits:['update:modelValue'],template:[
'<eva-media :model-value="modelValue" :multiple="true" mime="image" library="image"',
' :title="field.title || \'选择图库图片\'" :button-title="field.button_title || \'添加图片\'"',
' :placeholder="field.placeholder || \'拖拽多张图片到此处，或点击选择\'"',
' :return-type="field.return_type || field.returnType || \'array\'"',
' :max-size="field.max_size || field.maxSize || 8" :max-items="field.max_items || field.max || field.limit || 0"',
' :allowed-types="field.allowed_types || field.mime_types || \'jpg,jpeg,png,gif,webp,avif\'"',
' :preview="field.preview !== false" :show-drop="field.show_drop === true || field.showDrop === true"',
' :sortable="field.sortable !== false" :gallery="true" :layout="field.layout || field.display || \'masonry\'" :show-meta="field.show_meta === true"',
' @update:model-value="$emit(\'update:modelValue\',$event)"></eva-media>'].join('')};})();
