<template>
    <div id="preloader" :class="displayClass" >
        <i class="fa fa-spinner fa-pulse fa-4x fa-fw"></i><br>
        <span>{{message}}</span>
    </div>
</template>
<script>
    export default {
        mounted() {
            $("#preloader").find("i").css("margin-top",($(window).height()/2)-($("#preloader").find("i").outerHeight()/2));
        },
        data:function(){
            return{
                visible:false,
                message:"Loading..."
            }
        },
        computed:{
            displayClass(){
                if(this.visible){
                    return "fadeIn";
                }else{
                    return "fadeOut";
                }
            }
        }
    }
</script>
